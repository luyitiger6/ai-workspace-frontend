'use client'

import { Component, type ReactNode } from 'react'
import { SectionError } from './section-state'

interface Props {
  title: string
  children: ReactNode
}

interface State {
  failed: boolean
}

/** 单个区块的渲染错误不应连带其他区块，失败只降级自身。 */
export class SectionBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <SectionError message={`${this.props.title}暂时没能加载出来，稍后再试试。`} />
    }

    return this.props.children
  }
}
