
import React from 'react';
import { IconFileCode, IconGitBranch, IconZap, IconGitMerge } from '../components/Icons';
import { SidebarViewConfig } from '../types';

export const SIDEBAR_VIEWS: SidebarViewConfig[] = [
  {
    id: 'explorer',
    title: 'File Explorer (Cmd+B)',
    icon: IconFileCode,
  },
  {
    id: 'git',
    title: 'Source Control',
    icon: IconGitBranch,
  },
  {
    id: 'changes',
    title: 'AI Proposals',
    icon: IconGitMerge,
  },
  {
    id: 'extensions',
    title: 'Extensions',
    icon: IconZap,
  },
];
