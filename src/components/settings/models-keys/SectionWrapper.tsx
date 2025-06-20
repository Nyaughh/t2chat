import React from 'react'
import { SectionWrapperProps } from './types'

export const SectionWrapper = ({ title, description, addKeyButton, children }: SectionWrapperProps) => (
  <div>
    <div className="flex justify-between items-start mb-3"> 
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {addKeyButton && (
        <div className="flex items-center gap-2">
          {addKeyButton}
        </div>
      )}
    </div>
    <div className="space-y-3 rounded-lg bg-muted/20 border border-border/50 p-3">{children}</div>
  </div>
) 