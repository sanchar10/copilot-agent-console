"""Local Tools models."""

from typing import Any, Callable
from pydantic import BaseModel, Field


class ToolSpec(BaseModel):
    """Tool specification loaded from a Python module."""
    
    name: str = Field(..., description="Unique tool name, format: {module}:{function}")
    description: str = Field(..., description="What the tool does (shown to model)")
    parameters: dict = Field(..., description="JSON Schema for arguments (OpenAI-style)")
    source_file: str = Field(..., description="Path to the Python file containing this tool")
    
    class Config:
        # Allow arbitrary types for the handler (which is a Callable)
        arbitrary_types_allowed = True


class ToolSpecWithHandler(ToolSpec):
    """Tool spec with handler - used internally, not serialized to API."""
    
    handler: Callable[..., Any] = Field(..., description="Python function to execute")
    
    class Config:
        arbitrary_types_allowed = True


class ToolInfo(BaseModel):
    """Tool info returned by API (no handler)."""
    
    name: str
    description: str
    parameters: dict
    source_file: str


class ToolsConfig(BaseModel):
    """Collection of loaded tools."""
    
    tools: list[ToolInfo] = Field(default_factory=list)


class ToolSelection(BaseModel):
    """User's selection of tools for a session."""
    
    # Map of tool name -> enabled status
    selections: dict[str, bool] = Field(default_factory=dict)


class ToolResult(BaseModel):
    """Result from executing a tool."""
    
    result_type: str = Field(..., description="'success' or 'failure'")
    text_result_for_llm: str = Field(..., description="Text result to return to the model")
    error: str | None = Field(default=None, description="Error message if failed")
