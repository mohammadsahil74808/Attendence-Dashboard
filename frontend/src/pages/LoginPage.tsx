import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Activity, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { user, login, isLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [showPwd, setShowPwd] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  if (user) return <Navigate to="/dashboard" replace />

  async function onSubmit(data: LoginForm) {
    try {
      await login(data.email, data.password)
      navigate('/dashboard')
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Login failed. Check your credentials.', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      {/* Background grid texture */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(to right, #3b82f6 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <p className="text-base font-semibold text-text-primary">Follow-Up Manager</p>
            <p className="text-xs text-text-muted">Internal Operations Tool</p>
          </div>
        </div>

        {/* Card */}
        <div className="panel p-6">
          <h1 className="text-lg font-semibold text-text-primary mb-1">Sign in</h1>
          <p className="text-sm text-text-muted mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center h-9"
            >
              {isLoading ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : null}
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-surface-2 space-y-2">
            <p className="text-xs text-text-muted font-medium">Quick Fill Credentials:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setValue('email', 'admin@fms.internal')
                  setValue('password', 'admin123')
                }}
                className="btn-secondary text-xs h-8 justify-center"
              >
                Admin (admin123)
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue('email', 'member@fms.internal')
                  setValue('password', 'member123')
                }}
                className="btn-secondary text-xs h-8 justify-center"
              >
                Member (member123)
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          Contact your administrator for access
        </p>
      </div>
    </div>
  )
}
