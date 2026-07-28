'use client';

import { MAX_STEPS, MIN_STEPS } from '@/lib/builder/builder-reducer';
import styles from './builder.module.css';

interface StepControlsProps {
  readonly stepCount: number;
  readonly onChange: (count: number) => void;
}

const PRESETS: readonly { readonly count: number; readonly label: string }[] = [
  { count: 3, label: '3 · Core Trio' },
  { count: 5, label: '5 · Classic UI' },
  { count: MAX_STEPS, label: '10 · Full Tokens' },
];

export function StepControls({ stepCount, onChange }: StepControlsProps) {
  return (
    <div className={styles.stepControls}>
      <div className={styles.stepPills} role="group" aria-label="Step count presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.count}
            type="button"
            className={styles.stepPill}
            data-active={stepCount === preset.count}
            onClick={() => onChange(preset.count)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <label className={styles.stepCustomField}>
        <span>custom</span>
        <input
          type="number"
          min={MIN_STEPS}
          max={MAX_STEPS}
          value={stepCount}
          className={styles.stepCustomInput}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) onChange(value);
          }}
          aria-label={`Custom step count, ${MIN_STEPS} to ${MAX_STEPS}`}
        />
      </label>
    </div>
  );
}
