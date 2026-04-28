import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'conversations',
    loadComponent: () => import('./conversations/conversations.page').then(m => m.ConversationsPage),
  },
  {
    path: 'chat/:id',
    loadComponent: () => import('./home/home.page').then(m => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'conversations',
    pathMatch: 'full',
  },
];
