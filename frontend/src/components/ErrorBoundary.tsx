import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-900">The page failed to load</h1>
          <p className="mt-2 text-sm text-slate-600">Refresh with Ctrl+Shift+R. If it happens again, the error is:</p>
          <pre className="mt-3 overflow-auto rounded-lg bg-red-50 p-3 text-xs text-red-800">{this.state.error.message}</pre>
          <button
            type="button"
            className="mt-4 rounded-lg bg-clinic-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => {
              this.setState({ error: null });
              window.location.assign('/login');
            }}
          >
            Back to sign-in
          </button>
        </div>
      </div>
    );
  }
}
