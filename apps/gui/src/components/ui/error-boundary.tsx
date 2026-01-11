/**
 * Error Boundary component for React
 * Catches JavaScript errors anywhere in the child component tree
 */

import { AlertCircle, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI */
  fallback?: ReactNode;
  /** Component name for better error tracking */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error Boundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleForceReload = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="container mx-auto max-w-2xl px-4 py-10">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
                An error occurred
                {this.props.componentName && (
                  <span className="text-sm font-normal text-muted-foreground">
                    in {this.props.componentName}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                An unexpected error occurred. Please try again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="rounded-lg border border-destructive/20 bg-card p-3 text-sm">
                  <p className="font-medium text-destructive">
                    {this.state.error.message || "Unknown error"}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </Button>
                <Button onClick={this.handleForceReload} variant="outline">
                  Reload page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
