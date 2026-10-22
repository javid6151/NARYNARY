import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto pt-24 px-4 text-center space-y-4">
          <h1 className="text-xl font-semibold text-bad">Something went wrong</h1>
          <p className="text-[13px] text-muted">{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button
              variant="secondary"
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
            >
              Sign out & Re-login
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
