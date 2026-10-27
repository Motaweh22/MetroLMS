import React, { useEffect, useCallback } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';

export interface BlockerBridgeProps {
  isDirty: boolean;
  onBlockStateChange: (blocker: ReturnType<typeof useBlocker>) => void;
}

export const DataRouterBlockerBridge: React.FC<BlockerBridgeProps> = ({
  isDirty,
  onBlockStateChange,
}) => {
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => {
      if (!isDirty) return false;
      // Do not block internal query updates or identical destinations
      return (
        currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search
      );
    },
    [isDirty]
  );

  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    onBlockStateChange(blocker);
  }, [blocker, onBlockStateChange]);

  return null;
};
