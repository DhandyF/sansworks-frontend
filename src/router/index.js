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
        path: 'brands/:id',
        name: 'brand-detail',
        component: () => import('@/views/master-data/BrandDetailView.vue'),
      },
      {
        path: 'tailors',
        name: 'tailors',
        component: () => import('@/views/master-data/TailorsView.vue'),
      },
      {
        path: 'tailors/:id',
        name: 'tailor-detail',
        component: () => import('@/views/master-data/TailorDetailView.vue'),
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
      {
        path: 'pre-orders/:id',
        name: 'pre-order-detail',
        component: () => import('@/views/pre-order/PreOrderDetailView.vue'),
      },
      {
        path: 'shipments',
        name: 'shipments',
        component: () => import('@/views/shipment/ShipmentsView.vue'),
      },
      {
        path: 'qc',
        name: 'qc',
        component: () => import('@/views/qc/QCView.vue'),
      },
      {
        path: 'payslips',
        name: 'payslips',
        component: () => import('@/views/payslip/PayslipView.vue'),
      },
      {
        path: 'production',
        name: 'production',
        component: () => import('@/views/production/ProductionView.vue'),
      },
    ],
  },
  {
    path: '/client',
    component: () => import('@/layouts/ClientLayout.vue'),
    meta: { requiresAuth: true, clientOnly: true },
    children: [
      {
        path: 'brands/:id',
        name: 'client-brand-detail',
        component: () => import('@/views/master-data/BrandDetailView.vue'),
      },
      {
        path: 'pre-orders/:id',
        name: 'client-pre-order-detail',
        component: () => import('@/views/pre-order/PreOrderDetailView.vue'),
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

  // Authentication check
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  // Guest route handling
  if (to.meta.guest && auth.isAuthenticated) {
    // Admin and operator users go to dashboard
    if (auth.isAdmin || auth.isOperator) {
      return { path: '/' }
    }

    // Client users redirect to their assigned brand
    if (auth.isClient && auth.userBrands.length > 0) {
      return { name: 'client-brand-detail', params: { id: auth.userBrands[0].id } }
    }

    return { path: '/' }
  }

  // Client-specific restrictions
  if (auth.isClient) {
    // Only allow client routes for client users
    if (to.name !== 'client-brand-detail' && to.name !== 'client-pre-order-detail') {
      if (auth.userBrands.length > 0) {
        return { name: 'client-brand-detail', params: { id: auth.userBrands[0].id } }
      }
      return { name: 'login' }
    }

    // Check brand access only for brand routes
    if (to.name === 'client-brand-detail') {
      const brandId = to.params.id
      if (!auth.hasBrandAccess(brandId)) {
        if (auth.userBrands.length > 0) {
          return { name: 'client-brand-detail', params: { id: auth.userBrands[0].id } }
        }
        return { name: 'login' }
      }
    }
  }

  // Admin and operator users: no restrictions, allow all routes
})

export default router