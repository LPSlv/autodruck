import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WizardShell } from '@/components/WizardShell';
import type { Step } from '@/state';

const stepValidity: Record<Step, boolean> = {
  hardware: true,
  files: true,
  tune: false,
  review: false
};

function renderShell(onJumpStep = vi.fn()) {
  return render(
    <WizardShell
      step="hardware"
      canBack={false}
      canNext={true}
      onBack={vi.fn()}
      onNext={vi.fn()}
      onJumpStep={onJumpStep}
      stepValidity={stepValidity}
      advancedTrigger={<button>Advanced</button>}
    >
      <div>content</div>
    </WizardShell>
  );
}

describe('WizardShell progress dots', () => {
  it('calls onJumpStep when clicking an enabled dot', () => {
    const onJumpStep = vi.fn();
    renderShell(onJumpStep);
    const filesBtn = screen.getByRole('button', { name: /go to files/i });
    fireEvent.click(filesBtn);
    expect(onJumpStep).toHaveBeenCalledWith('files');
  });

  it('does NOT call onJumpStep when clicking a disabled dot', () => {
    const onJumpStep = vi.fn();
    renderShell(onJumpStep);
    const tuneBtn = screen.getByRole('button', { name: /go to tune/i });
    expect(tuneBtn).toBeDisabled();
    fireEvent.click(tuneBtn);
    expect(onJumpStep).not.toHaveBeenCalled();
  });
});
