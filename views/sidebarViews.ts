

import React from 'react';
import { IconFileCode, IconGitBranch, IconZap } from '../components/Icons';
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
    id: 'extensions',
    title: 'Extensions',
    icon: IconZap,
  },
];