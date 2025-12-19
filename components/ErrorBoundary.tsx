import React, { Component, ErrorInfo, ReactNode } from 'react';
import { IconAlert } from './Icons';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  // Explicitly defining constructor and calling super(props) to ensure this.props is correctly inherited and typed
  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-red-500/10 text-red-300 p-4 rounded-lg border border-red-500/20">
            <IconAlert size={32} className="mb-4" />
            <h1 className="text-lg font-bold text-red-200">Component Error</h1>
            <p className="text-sm text-red-300/80">Something went wrong here. Try refreshing the page.</p>
        </div>
      );
    }

    // Fixed property 'props' error by ensuring proper class inheritance from Component
    return this.props.children;
  }
}

export default ErrorBoundary;