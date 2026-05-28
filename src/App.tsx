import { useCallback, useEffect, useReducer, useState } from 'react';
import { WizardShell, AdvancedTrigger } from '@/components/WizardShell';
import { Step1Hardware } from '@/steps/Step1Hardware';
import { Step2Files } from '@/steps/Step2Files';
import { Step3Tune } from '@/steps/Step3Tune';
import { Step4Review } from '@/steps/Step4Review';
import { AdvancedSheet } from '@/components/AdvancedSheet';
import { CommandPalette } from '@/components/CommandPalette';
import { Toaster, toast } from 'sonner';
import { reducer, initialState, type Step } from '@/state';
import { loadPersisted, savePersisted } from '@/lib/store';
import {
  buildMerged, downloadBlob, downloadEach, mergedFilename
} from '@/lib/output';
import { useHotkeys } from '@/lib/hotkeys';

const STEP_ORDER: Step[] = ['hardware', 'files', 'tune', 'review'];

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [hydrated, setHydrated] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const p = loadPersisted();
    dispatch({ type: 'hydrate', partial: {
      printer: p.printer ?? state.printer,
      globalDefaults: p.globalDefaults ?? state.globalDefaults,
      customTemplates: p.customTemplates ?? state.customTemplates,
      cost: p.cost ?? state.cost
    } });
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => savePersisted({
      printer: state.printer,
      globalDefaults: state.globalDefaults,
      customTemplates: state.customTemplates,
      cost: state.cost
    }), 300);
    return () => clearTimeout(t);
  }, [hydrated, state.printer, state.globalDefaults, state.customTemplates, state.cost]);

  const stepIdx = STEP_ORDER.indexOf(state.step);
  const canBack = stepIdx > 0;
  const validJobs = state.jobs.filter((j) => !j.error && j.metrics != null);
  const canNext =
    (state.step === 'hardware') ||
    (state.step === 'files' && validJobs.length > 0) ||
    (state.step === 'tune');
  const mismatched = state.jobs.filter(
    (j) => j.detectedPrinter && j.detectedPrinter !== state.printer && !j.error
  ).length;
  const canMerge = mismatched === 0 && validJobs.length > 0;
  const canDownloadEach = validJobs.length > 0;

  const stepValidity: Record<Step, boolean> = {
    hardware: true,
    files: true,
    tune: validJobs.length > 0,
    review: validJobs.length > 0
  };

  const handleNext = useCallback(() => {
    if (stepIdx < STEP_ORDER.length - 1) dispatch({ type: 'goto', step: STEP_ORDER[stepIdx + 1] });
  }, [stepIdx]);

  const handleBack = useCallback(() => {
    if (stepIdx > 0) dispatch({ type: 'goto', step: STEP_ORDER[stepIdx - 1] });
  }, [stepIdx]);

  function handleJumpStep(s: Step) { dispatch({ type: 'goto', step: s }); }

  const handleMerge = useCallback(() => {
    try {
      const merged = buildMerged(validJobs, state);
      const name = mergedFilename(state.printer, validJobs.length, merged);
      downloadBlob(name, merged);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [validJobs, state]);

  const handleEach = useCallback(async () => {
    try { await downloadEach(validJobs, state); }
    catch (e) { toast.error((e as Error).message); }
  }, [validJobs, state]);

  const openAdvanced = useCallback(() => {
    dispatch({ type: 'toggleAdvanced', open: true });
  }, []);

  useHotkeys([
    {
      key: 'ArrowLeft',
      preventInInput: true,
      handler: () => { if (canBack) handleBack(); }
    },
    {
      key: 'ArrowRight',
      preventInInput: true,
      handler: () => { if (canNext) handleNext(); }
    },
    {
      key: 'Enter',
      preventInInput: true,
      handler: () => {
        if (state.step !== 'review' && canNext) handleNext();
        else if (state.step === 'review' && canMerge) handleMerge();
      }
    },
    {
      key: 'o',
      cmd: true,
      handler: () => {
        if (state.step !== 'files') {
          dispatch({ type: 'goto', step: 'files' });
        } else {
          document.querySelector<HTMLInputElement>('input[type=file]')?.click();
        }
      }
    },
    {
      key: 'k',
      cmd: true,
      handler: () => setPaletteOpen((v) => !v)
    },
    {
      key: '?',
      preventInInput: true,
      handler: () => {
        document.dispatchEvent(new CustomEvent('autodruck:toggle-hints'));
      }
    }
  ]);

  return (
    <>
      <WizardShell
        step={state.step}
        canBack={canBack}
        canNext={canNext}
        onBack={handleBack}
        onNext={handleNext}
        onJumpStep={handleJumpStep}
        stepValidity={stepValidity}
        primaryAction={state.step === 'review'
          ? { label: `Download merged ↵`, onClick: handleMerge, disabled: !canMerge }
          : undefined}
        ghostAction={state.step === 'review'
          ? { label: 'Download each', onClick: () => void handleEach(), disabled: !canDownloadEach }
          : undefined}
        advancedTrigger={<AdvancedTrigger onClick={openAdvanced} />}
      >
        {state.step === 'hardware' && (
          <Step1Hardware
            printer={state.printer}
            onPrinter={(p) => dispatch({ type: 'setPrinter', printer: p })}
          />
        )}
        {state.step === 'files' && (
          <Step2Files
            jobs={state.jobs} printer={state.printer}
            onAdd={(files) => dispatch({ type: 'addJobs', files })}
            onRemove={(id) => dispatch({ type: 'removeJob', id })}
          />
        )}
        {state.step === 'tune' && (
          <Step3Tune
            printer={state.printer}
            jobs={state.jobs} globalDefaults={state.globalDefaults}
            onJobRepeats={(id, n) => dispatch({ type: 'setJobRepeats', id, repeats: n })}
            onJobOverride={(id, patch) => dispatch({ type: 'setJobOverride', id, patch })}
            onOpenAdvanced={openAdvanced}
          />
        )}
        {state.step === 'review' && (
          <Step4Review jobs={state.jobs} cost={state.cost} mismatchedCount={mismatched} />
        )}
      </WizardShell>

      <AdvancedSheet
        open={state.advancedOpen}
        onOpenChange={(v) => dispatch({ type: 'toggleAdvanced', open: v })}
        printer={state.printer}
        globalDefaults={state.globalDefaults}
        customTemplates={state.customTemplates}
        cost={state.cost}
        onTuningPatch={(patch) => dispatch({ type: 'setGlobalDefault', patch })}
        onTemplatesPatch={(templates) => dispatch({ type: 'setCustomTemplates', templates })}
        onCostPatch={(patch) => dispatch({ type: 'setCost', patch })}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        currentPrinter={state.printer}
        stepValidity={stepValidity}
        canMerge={canMerge}
        canDownloadEach={canDownloadEach}
        onJump={handleJumpStep}
        onPickPrinter={(p) => dispatch({ type: 'setPrinter', printer: p })}
        onOpenAdvanced={openAdvanced}
        onMerge={handleMerge}
        onDownloadEach={() => void handleEach()}
      />

      <Toaster richColors position="bottom-right" />
    </>
  );
}
