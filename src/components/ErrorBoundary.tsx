import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

const ErrorBoundary: React.FC<Props> = ({ children }) => {
  return <>{children}</>;
};

export default ErrorBoundary;
