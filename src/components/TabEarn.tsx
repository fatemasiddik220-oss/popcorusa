import React from 'react';
import { User, EcosystemTask, AdminConfig } from '../types.js';
import { TabTasks } from './TabTasks.js';

interface TabEarnProps {
  user: User;
  tasks: EcosystemTask[];
  config: AdminConfig;
  onDailyCheckIn: () => Promise<void>;
  onCompleteTask: (taskId: string, elapsedSeconds?: number) => Promise<void>;
  onRefreshTasks?: () => Promise<void>;
}

export const TabEarn: React.FC<TabEarnProps> = (props) => {
  return <TabTasks {...props} />;
};

export { TabTasks };
