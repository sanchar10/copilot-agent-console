/**
 * Ralph AI Runner Monitor Component
 */

import { useEffect, useState } from 'react';
import { useRalphStore } from '../../stores/ralphStore';
import type { RunStatus, JobStatus, Job, JobHistory, JobEvent } from '../../api/ralph';
import { getJobHistory, streamRun } from '../../api/ralph';

// Status colors
const statusColors: Record<RunStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  failed: 'bg-red-100 text-red-700',
};

const jobStatusColors: Record<JobStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700 animate-pulse',
  approved: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-500',
  needs_fix: 'bg-orange-100 text-orange-700',
  failed: 'bg-red-100 text-red-700',
};

// User-friendly status labels
const statusLabels: Record<RunStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  paused: 'Stopping...',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

export function RalphMonitor() {
  const {
    runs,
    selectedRunId,
    selectedRun,
    selectedBatch,
    isLoading,
    error,
    refreshRuns,
    loadRunDetails,
    selectRun,
    approveJob,
    skipJob,
    retryJob,
    submitFeedback,
    setAutoApprove,
    stopRun,
    resumeRun,
    deleteRun,
  } = useRalphStore();
  
  const [feedbackText, setFeedbackText] = useState('');
  
  // Expandable job rows state
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [jobHistories, setJobHistories] = useState<Record<string, JobHistory>>({});
  const [loadingHistory, setLoadingHistory] = useState<Set<string>>(new Set());
  
  // Streaming content for in-progress jobs
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const [, setActiveJobId] = useState<string | null>(null);
  
  // Toggle job expansion
  const toggleJobExpanded = async (runId: string, job: Job) => {
    const isExpanded = expandedJobs.has(job.id);
    
    if (isExpanded) {
      // Collapse
      setExpandedJobs(prev => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    } else {
      // Expand - load history if needed
      setExpandedJobs(prev => new Set(prev).add(job.id));
      
      // Load history if we don't have it and job has completed
      if (!jobHistories[job.id] && job.status !== 'running' && job.sdk_session_id) {
        setLoadingHistory(prev => new Set(prev).add(job.id));
        try {
          const history = await getJobHistory(runId, job.id);
          setJobHistories(prev => ({ ...prev, [job.id]: history }));
        } catch (e) {
          console.error('Failed to load job history:', e);
        } finally {
          setLoadingHistory(prev => {
            const next = new Set(prev);
            next.delete(job.id);
            return next;
          });
        }
      }
    }
  };

  // Initial load - only once
  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  // Poll runs list infrequently (for sidebar updates only)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshRuns();
    }, 10000); // Every 10 seconds for runs list
    
    return () => clearInterval(interval);
  }, [refreshRuns]);

  // Handle selected run - use SSE for active, one-time fetch for completed
  useEffect(() => {
    if (!selectedRunId) return;
    
    // Load initial details
    loadRunDetails(selectedRunId);
  }, [selectedRunId, loadRunDetails]);

  // Subscribe to SSE only for ACTIVE runs (pending, running, paused)
  useEffect(() => {
    if (!selectedRunId || !selectedRun) return;
    
    // Only use SSE for active runs
    const isActive = ['pending', 'running', 'paused'].includes(selectedRun.status);
    if (!isActive) return;
    
    const handleState = (run: import('../../api/ralph').RalphRun, batch: import('../../api/ralph').ExecutionBatch | null) => {
      // Update store with SSE state
      useRalphStore.getState().setSelectedRunDetails(run, batch);
    };
    
    const handleComplete = () => {
      refreshRuns(); // Update runs list when complete
    };
    
    const handleError = (msg: string) => {
      console.error('SSE error:', msg);
    };
    
    const handleJobEvent = (event: JobEvent) => {
      if (event.type === 'job_start') {
        setActiveJobId(event.job_id);
        setStreamingContent(prev => ({ ...prev, [event.job_id]: '' }));
        // Auto-expand the running job
        setExpandedJobs(prev => new Set(prev).add(event.job_id));
      } else if (event.type === 'job_event') {
        // Accumulate streaming content
        if (event.event_type === 'assistant.message.delta' && event.data.delta) {
          setStreamingContent(prev => ({
            ...prev,
            [event.job_id]: (prev[event.job_id] || '') + event.data.delta
          }));
        }
      } else if (event.type === 'job_complete') {
        setActiveJobId(null);
        // SSE state update will handle the rest
      } else if (event.type === 'job_error') {
        setActiveJobId(null);
      }
    };
    
    const cleanup = streamRun(
      selectedRunId,
      handleState,
      handleComplete,
      handleError,
      handleJobEvent
    );
    
    return cleanup;
  }, [selectedRunId, loadRunDetails, refreshRuns]);

  const handleFeedbackSubmit = async () => {
    if (selectedRunId && feedbackText.trim()) {
      await submitFeedback(selectedRunId, feedbackText.trim());
      setFeedbackText('');
    }
  };

  // Get current job from batch
  const currentJob = selectedBatch && selectedRun 
    ? selectedBatch.jobs[selectedRun.current_job_index] 
    : null;

  // Split runs into active and history
  const activeRuns = runs.filter(r => ['pending', 'running', 'paused'].includes(r.status));
  const historyRuns = runs.filter(r => ['completed', 'cancelled', 'failed'].includes(r.status));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl border-b border-white/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h2 className="font-semibold text-gray-900">Ralph AI Runner</h2>
          {activeRuns.length > 0 && (
            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
              {activeRuns.length} active
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Run List */}
        <div className="w-64 border-r border-white/30 bg-white/40 backdrop-blur overflow-y-auto">
          {/* Active Runs */}
          {activeRuns.length > 0 && (
            <div className="p-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Active Runs</h3>
              <div className="space-y-2">
                {activeRuns.map(run => (
                  <button
                    key={run.id}
                    onClick={() => selectRun(run.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      selectedRunId === run.id 
                        ? 'border-blue-400/60 bg-blue-50/60' 
                        : 'border-white/40 hover:bg-white/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[run.status]}`}>
                        {statusLabels[run.status]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {run.current_job_index}/{run.total_jobs}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {run.workspace.split(/[/\\]/).pop()}
                    </div>
                    {run.current_job_description && (
                      <div className="text-xs text-gray-500 truncate mt-1">
                        {run.current_job_description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {historyRuns.length > 0 && (
            <div className="p-3 border-t border-white/30">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">History</h3>
              <div className="space-y-2">
                {historyRuns.slice(0, 10).map(run => (
                  <button
                    key={run.id}
                    onClick={() => selectRun(run.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      selectedRunId === run.id 
                        ? 'border-blue-400/60 bg-blue-50/60' 
                        : 'border-white/40 hover:bg-white/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[run.status]}`}>
                        {statusLabels[run.status]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {run.current_job_index}/{run.total_jobs}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 truncate">
                      {run.workspace.split(/[/\\]/).pop()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {runs.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No runs yet. Start Ralph from a chat session.
            </div>
          )}
        </div>

        {/* Run Details */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedRun && selectedBatch ? (
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Run Header */}
              <div className="bg-white/50 backdrop-blur rounded-lg border border-white/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedBatch.workspace.split(/[/\\]/).pop()}
                    </h3>
                    <p className="text-sm text-gray-500">{selectedBatch.source_description || 'Manual jobs'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[selectedRun.status]}`}>
                    {statusLabels[selectedRun.status]}
                  </span>
                </div>
                
                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{selectedRun.current_job_index}/{selectedBatch.jobs.length} jobs</span>
                  </div>
                  <div className="w-full bg-white/40 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${(selectedRun.current_job_index / selectedBatch.jobs.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedRun.auto_approve}
                      onChange={(e) => setAutoApprove(selectedRun.id, e.target.checked)}
                      className="rounded text-blue-500"
                    />
                    Auto-approve
                  </label>
                  
                  {/* Cancel buttons - show for any active run */}
                  {['pending', 'running', 'paused'].includes(selectedRun.status) && (
                    <>
                      <button
                        onClick={() => stopRun(selectedRun.id, false)}
                        className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                        title="Stop after the current loop completes"
                      >
                        Cancel After Current
                      </button>
                      <button
                        onClick={() => stopRun(selectedRun.id, true)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        title="Stop immediately (may leave work incomplete)"
                      >
                        Cancel Now
                      </button>
                    </>
                  )}
                  
                  {/* Resume - only for paused runs (user clicked Cancel After Current) */}
                  {selectedRun.status === 'paused' && (
                    <button
                      onClick={() => resumeRun(selectedRun.id)}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                      title="Continue execution from where it was paused"
                    >
                      Resume
                    </button>
                  )}
                  
                  {/* Resume - for cancelled runs that can be restarted */}
                  {selectedRun.status === 'cancelled' && (
                    <button
                      onClick={() => resumeRun(selectedRun.id)}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                      title="Restart execution from where it was cancelled"
                    >
                      Resume
                    </button>
                  )}
                  
                  {['completed', 'cancelled', 'failed'].includes(selectedRun.status) && (
                    <button
                      onClick={() => deleteRun(selectedRun.id)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Current Job */}
              {currentJob && (
                <div className="bg-white/50 backdrop-blur rounded-lg border border-white/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">
                      Current Job ({selectedRun.current_job_index + 1}/{selectedBatch.jobs.length})
                    </h4>
                    <span className={`px-2 py-0.5 text-xs rounded ${jobStatusColors[currentJob.status]}`}>
                      {currentJob.status}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 mb-3">{currentJob.description}</p>
                  
                  {currentJob.context && (
                    <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded mb-3">
                      {currentJob.context}
                    </div>
                  )}
                  
                  {currentJob.result && (
                    <div className="border-t pt-3 mt-3">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Result:</h5>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{currentJob.result.summary}</p>
                      
                      {currentJob.result.files.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">Files: </span>
                          <span className="text-xs text-gray-700">{currentJob.result.files.join(', ')}</span>
                        </div>
                      )}
                      
                      {currentJob.result.assumptions.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">Assumptions: </span>
                          <span className="text-xs text-gray-700">{currentJob.result.assumptions.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Job Actions */}
                  {selectedRun.status === 'paused' && currentJob.status === 'pending' && (
                    <div className="border-t pt-3 mt-3 space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveJob(selectedRun.id)}
                          disabled={isLoading}
                          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => skipJob(selectedRun.id)}
                          disabled={isLoading}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                          ⏭ Skip
                        </button>
                        <button
                          onClick={() => retryJob(selectedRun.id)}
                          disabled={isLoading}
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                        >
                          ↻ Retry
                        </button>
                      </div>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Feedback (what should be fixed)..."
                          className="flex-1 px-3 py-2 border border-white/40 bg-white/50 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          onKeyDown={(e) => e.key === 'Enter' && handleFeedbackSubmit()}
                        />
                        <button
                          onClick={handleFeedbackSubmit}
                          disabled={isLoading || !feedbackText.trim()}
                          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                        >
                          Send Feedback
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Job List - Expandable */}
              <div className="bg-white/50 backdrop-blur rounded-lg border border-white/40 p-4">
                <h4 className="font-medium text-gray-900 mb-3">All Jobs</h4>
                <div className="space-y-2">
                  {selectedBatch.jobs.map((job, index) => {
                    const isExpanded = expandedJobs.has(job.id);
                    const history = jobHistories[job.id];
                    const isLoadingHist = loadingHistory.has(job.id);
                    const isRunning = job.status === 'running';
                    const streaming = streamingContent[job.id];
                    
                    return (
                      <div 
                        key={job.id}
                        className={`rounded border ${
                          index === selectedRun.current_job_index 
                            ? 'border-blue-300/60 bg-blue-50/40' 
                            : 'border-white/40'
                        }`}
                      >
                        {/* Job Header - Clickable */}
                        <button
                          onClick={() => toggleJobExpanded(selectedRun.id, job)}
                          className="w-full p-2 flex items-center justify-between hover:bg-white/40 rounded-t"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                            <span className="text-sm text-gray-700 truncate">
                              {index + 1}. {job.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {job.sdk_session_id && (
                              <span className="text-xs text-gray-400" title="Has session log">
                                📋
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded ${jobStatusColors[job.status]}`}>
                              {job.status}
                            </span>
                          </div>
                        </button>
                        
                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="border-t border-white/40 p-3 bg-white/30">
                            {/* Context if any */}
                            {job.context && (
                              <div className="text-xs text-gray-500 mb-2 p-2 bg-white/50 rounded">
                                {job.context}
                              </div>
                            )}
                            
                            {/* Streaming content for running job */}
                            {isRunning && streaming && (
                              <div className="mb-2">
                                <div className="text-xs font-medium text-blue-600 mb-1">
                                  🔄 Agent is working...
                                </div>
                                <div className="text-xs text-gray-700 bg-white p-2 rounded border max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
                                  {streaming}
                                </div>
                              </div>
                            )}
                            
                            {/* Loading history */}
                            {isLoadingHist && (
                              <div className="text-xs text-gray-500 animate-pulse">
                                Loading agent history...
                              </div>
                            )}
                            
                            {/* Job history messages */}
                            {history && history.messages.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-gray-600">Agent Log:</div>
                                <div className="max-h-64 overflow-y-auto space-y-1">
                                  {history.messages.map((msg, msgIdx) => (
                                    <div key={msgIdx} className="text-xs p-2 rounded bg-white border">
                                      {msg.role === 'user' && (
                                        <div className="text-blue-700">
                                          <span className="font-medium">Prompt: </span>
                                          {msg.content?.substring(0, 200)}
                                          {(msg.content?.length || 0) > 200 && '...'}
                                        </div>
                                      )}
                                      {msg.role === 'assistant' && (
                                        <div className="text-gray-700 whitespace-pre-wrap font-mono">
                                          {msg.content}
                                        </div>
                                      )}
                                      {msg.role === 'tool_start' && (
                                        <div className="text-blue-600">
                                          ⚙️ Running: {msg.tool}
                                        </div>
                                      )}
                                      {msg.role === 'tool_complete' && (
                                        <div className="text-green-600">
                                          ✓ {msg.tool}: {msg.result?.substring(0, 100)}
                                          {(msg.result?.length || 0) > 100 && '...'}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Result if available */}
                            {job.result && (
                              <div className="mt-2 pt-2 border-t">
                                <div className="text-xs font-medium text-gray-600 mb-1">Result:</div>
                                <div className="text-xs text-gray-700 whitespace-pre-wrap">
                                  {job.result.summary}
                                </div>
                                {job.result.files.length > 0 && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    Files: {job.result.files.join(', ')}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* No history available */}
                            {!isRunning && !isLoadingHist && !history && !job.sdk_session_id && job.status !== 'pending' && (
                              <div className="text-xs text-gray-400 italic">
                                No agent log available for this job
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-lg font-medium">Select a run to view details</p>
                <p className="text-sm mt-1">Or start a new Ralph run from a chat session</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="absolute bottom-4 right-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
