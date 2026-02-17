interface TokenUsageSliderProps {
  tokenLimit?: number;
  currentTokens?: number;
  messagesLength?: number;
  isActive: boolean; // Whether streaming is currently active
}

export function TokenUsageSlider({ 
  tokenLimit, 
  currentTokens, 
  messagesLength, 
  isActive: _isActive 
}: TokenUsageSliderProps) {
  // Show gray/disabled bar only when no token data exists
  // Keep colored bar after streaming ends to show final usage
  if (!tokenLimit || currentTokens === undefined) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-xs font-medium text-gray-400">Tokens</span>
        <div className="w-32 h-2 bg-gray-200 rounded-full" />
        <span className="text-xs text-gray-400">-</span>
      </div>
    );
  }

  const percentage = (currentTokens / tokenLimit) * 100;
  const isOverHalf = percentage >= 50;
  const barColor = isOverHalf ? 'bg-orange-500' : 'bg-green-500';
  const textColor = isOverHalf ? 'text-orange-700' : 'text-green-700';

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
      title={`Token usage: ${currentTokens.toLocaleString()} / ${tokenLimit.toLocaleString()}\nMessages: ${messagesLength || 0}`}
    >
      <span className="text-xs font-medium text-gray-600">Tokens</span>
      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${barColor} transition-all duration-300 ease-out`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${textColor}`}>
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

