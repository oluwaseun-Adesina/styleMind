import React, { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F7F4] dark:bg-[#121212] p-8 text-center">
          <h1 className="font-serif text-4xl italic mb-4 dark:text-white">Something went wrong</h1>
          <p className="text-[#8E8E8A] mb-6 max-w-md">{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#1A1A1A] dark:bg-white text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
