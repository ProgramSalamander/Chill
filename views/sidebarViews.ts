
import React from 'react';
import { IconFileCode, IconGitBranch, IconZap, IconSparkles, IconActivity, IconSearch } from '../components/Icons';
import { SidebarViewConfig } from '../types';

export const SIDEBAR_VIEWS: SidebarViewConfig[] = [
  {
    id: 'explorer',
    title: 'File Explorer (Cmd+B)',
    icon: IconFileCode,
  },
  {
    id: 'search',
    title: 'Search in Files',
    icon: IconSearch,
  },
  {
    id: 'git',
    title: 'Source Control',
    icon: IconGitBranch,
  },
  {
    id: 'changes',
    title: 'AI Proposals',
    icon: IconSparkles,
  },
  {
      id: 'usage',
      title: 'Usage Analytics',
      icon: IconActivity
  },
  {
    id: 'extensions',
    title: 'Extensions',
    icon: IconZap,
  },
];
