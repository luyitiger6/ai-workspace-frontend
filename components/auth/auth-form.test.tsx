import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthForm } from './auth-form'

const { register, login, replace } = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('./auth-provider', () => ({
  useAuth: () => ({ register, login }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}))

function fillRegister(values: {
  name: string
  email: string
  password: string
  confirm: string
}) {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: values.name } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: values.email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: values.password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: values.confirm },
  })
}

describe('注册表单', () => {
  beforeEach(() => {
    register.mockReset()
    login.mockReset()
    replace.mockReset()
  })

  it('两次密码不一致时不调用 register 并给出提示', () => {
    render(<AuthForm mode="register" />)

    fillRegister({
      name: 'Road Tester',
      email: 'road@wanderchain.dev',
      password: 'secret123',
      confirm: 'secret124',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up and log in' }))

    expect(register).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('The two passwords do not match')
  })

  it('提交中按钮禁用且文案为 Working…', async () => {
    let finish: () => void = () => undefined
    register.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )

    render(<AuthForm mode="register" />)

    fillRegister({
      name: 'Road Tester',
      email: 'road@wanderchain.dev',
      password: 'secret123',
      confirm: 'secret123',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up and log in' }))

    const pendingButton = await screen.findByRole('button', { name: 'Working…' })

    expect(pendingButton).toBeDisabled()
    expect(register).toHaveBeenCalledWith({
      email: 'road@wanderchain.dev',
      password: 'secret123',
      name: 'Road Tester',
    })

    await act(async () => {
      finish()
    })
  })
})
