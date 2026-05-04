import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/DashboardLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/users' },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/master-data/UsersView.vue'),
      },
      {
        path: 'brands',
        name: 'brands',
        component: () => import('@/views/master-data/BrandsView.vue'),
      },
      {
        path: 'tailors',
        name: 'tailors',
        component: () => import('@/views/master-data/TailorsView.vue'),
      },
      {
        path: 'sizes',
        name: 'sizes',
        component: () => import('@/views/master-data/SizesView.vue'),
      },
      {
        path: 'articles',
        name: 'articles',
        component: () => import('@/views/master-data/ArticlesView.vue'),
      },
      {
        path: 'pre-orders',
        name: 'pre-orders',
        component: () => import('@/views/pre-order/PreOrdersView.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return { path: '/' }
  }
})

export default router