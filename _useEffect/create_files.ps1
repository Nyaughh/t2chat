for ($i = 1; $i -le 23; $i++) {
    $componentName = "useEffectComponent$($i)"
    $fileName = "$($componentName).js"
    $content = @"
import React, { useEffect } from 'react';

const $($componentName) = () => {
  useEffect(() => {
    // Effect 1
  });

  useEffect(() => {
    // Effect 2
  });

  useEffect(() => {
    // Effect 3
  });

  useEffect(() => {
    // Effect 4
  });

  useEffect(() => {
    // Effect 5
  });

  useEffect(() => {
    // Effect 6
  });

  useEffect(() => {
    // Effect 7
  });

  return (
    <div>
      This component uses useEffect 7 times.
    </div>
  );
};

export default $($componentName);
"@

    $content | Out-File -FilePath $fileName -Encoding utf8
}

Write-Host "Created 23 React component files." 