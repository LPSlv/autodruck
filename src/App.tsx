import { useEffect, useReducer, useState } from 'react';
import { WizardShell, AdvancedTrigger } from '@/components/WizardShell';
import { Step1Hardware } from '@/steps/Step1Hardware';
import { Step2Files } from '@/steps/Step2Files';
import { Step3Tune } from '@/steps/Step3Tune';
import { Step4Review } from '@/steps/Step4Review';
import { AdvancedSheet } from '@/components/AdvancedSheet';
import { Toaster, toast } from 'sonner';
import { reducer, initialState, type Step } from '@/state';
import { loadPersisted, savePersisted } from '@/lib/store';
import {
  buildMerged, downloadBlob, downloadEach, mergedFilename
} from '@/lib/output';

const STEP_ORDER: Step[] = ['hardware', 'files', 'tune', 'review'];

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = loadPersisted();
    dispatch({ type: 'hydrate', partial: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      printer: (p.printer as any) ?? state.printer,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stage: (p.stage as any) ?? state.stage,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      globalDefaults: (p.globalDefaults as any) ?? state.globalDefaults,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customTemplates: (p.customTemplates as any) ?? state.customTemplates,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cost: (p.cost as any) ?? state.cost
    }});
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => savePersisted({
      printer: state.printer,
      stage: state.stage,
      globalDefaults: state.globalDefaults,
      customTemplates: state.customTemplates,
      cost: state.cost
    }), 300);
    return () => clearTimeout(t);
  }, [hydrated, state.printer, state.stage, state.globalDefaults, state.customTemplates, state.cost]);

  const stepIdx = STEP_ORDER.indexOf(state.step);
  const canBack = stepIdx > 0;
  const validJobs = state.jobs.filter((j) => !j.error);
  const canNext =
    (state.step === 'hardware') ||
    (state.step === 'files' && validJobs.length > 0) ||
    (state.step === 'tune');
  const mismatched = state.jobs.filter(
    (j) => j.detectedPrinter && j.detectedPrinter !== state.printer && !j.error
  ).length;

  function handleNext() { if (stepIdx < STEP_ORDER.length - 1) dispatch({ type: 'goto', step: STEP_ORDER[stepIdx + 1] }); }
  function handleBack() { if (stepIdx > 0) dispatch({ type: 'goto', step: STEP_ORDER[stepIdx - 1] }); }

  function handleMerge() {
    try {
      const merged = buildMerged(validJobs, state);
      const name = mergedFilename(state.printer, state.stage, validJobs.length, merged);
      downloadBlob(name, merged);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleEach() {
    try { await downloadEach(validJobs, state); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <WizardShell
        step={state.step}
        canBack={canBack}
        canNext={canNext}
        onBack={handleBack}
        onNext={handleNext}
        primaryAction={state.step === 'review'
          ? { label: `Download merged ↵`, onClick: handleMerge, disabled: mismatched > 0 || validJobs.length === 0 }
          : undefined}
        ghostAction={state.step === 'review'
          ? { label: 'Download each', onClick: () => void handleEach(), disabled: validJobs.length === 0 }
          : undefined}
        advancedTrigger={<AdvancedTrigger onClick={() => dispatch({ type: 'toggleAdvanced', open: true })} />}
      >
        {state.step === 'hardware' && (
          <Step1Hardware
            printer={state.printer} stage={state.stage}
            onPrinter={(p) => dispatch({ type: 'setPrinter', printer: p })}
            onStage={(s) => dispatch({ type: 'setStage', stage: s })}
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
            printer={state.printer} stage={state.stage}
            jobs={state.jobs} globalDefaults={state.globalDefaults}
            onJobRepeats={(id, n) => dispatch({ type: 'setJobRepeats', id, repeats: n })}
            onJobOverride={(id, patch) => dispatch({ type: 'setJobOverride', id, patch })}
            onOpenAdvanced={() => dispatch({ type: 'toggleAdvanced', open: true })}
          />
        )}
        {state.step === 'review' && (
          <Step4Review jobs={state.jobs} cost={state.cost} mismatchedCount={mismatched} />
        )}
      </WizardShell>

      <AdvancedSheet
        open={state.advancedOpen}
        onOpenChange={(v) => dispatch({ type: 'toggleAdvanced', open: v })}
        printer={state.printer} stage={state.stage}
        globalDefaults={state.globalDefaults}
        customTemplates={state.customTemplates}
        cost={state.cost}
        onTuningPatch={(patch) => dispatch({ type: 'setGlobalDefault', patch })}
        onTemplatesPatch={(templates) => dispatch({ type: 'setCustomTemplates', templates })}
        onCostPatch={(patch) => dispatch({ type: 'setCost', patch })}
      />

      <Toaster richColors position="bottom-right" />
    </>
  );
}
