import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <h2 style={{ color: 'red', padding: '20px' }}>Something went wrong.</h2>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;