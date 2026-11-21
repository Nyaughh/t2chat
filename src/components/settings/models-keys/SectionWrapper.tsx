import React from 'react'
import { SettingsGroup } from '../primitives'
import { SectionWrapperProps } from './types'

export const SectionWrapper = ({ title, description, addKeyButton, children }: SectionWrapperProps) => (
  <SettingsGroup title={title} description={description} action={addKeyButton}>
    {children}
  </SettingsGroup>
)
