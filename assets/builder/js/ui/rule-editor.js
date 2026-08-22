/**
 * Editor for the battle rules list.
 *
 * A rule is a name, a match condition, an ordered list of steps, and a
 * fallback. Steps show only the inputs their action needs, which keeps a long
 * rule readable.
 */

import { RULE_FALLBACKS, STEP_ACTIONS, createEmptyRule, createStep, splitList } from '../domain/config.js';
import { renderConditionTree } from './condition-editor.js';
import { h } from './dom.js';

/** Which extra inputs each action shows, keyed by action id. */
const ACTION_NEEDS = new Map(STEP_ACTIONS.map((entry) => [entry.id, entry.needs]));

/**
 * @param {object[]} rules
 * @param {(next: object[]) => void} onChange
 * @returns {HTMLElement}
 */
export function renderRuleList(rules, onChange) {
  const replaceAt = (index, next) => onChange(rules.map((rule, i) => (i === index ? next : rule)));
  const removeAt = (index) => onChange(rules.filter((_, i) => i !== index));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= rules.length) return;
    const next = rules.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return h('div.rules', {}, [
    ...(rules.length
      ? rules.map((rule, index) => renderRule(rule, index, rules.length, {
        onChange: (next) => replaceAt(index, next),
        onRemove: () => removeAt(index),
        onMove: (delta) => move(index, delta),
      }))
      : [h('p.field-hint', { text: 'No rules yet — the script will not act on wild encounters.' })]),
    h('button.btn.btn-ghost', {
      type: 'button',
      text: '+ Add a rule',
      onClick: () => onChange([...rules, createEmptyRule()]),
    }),
  ]);
}

/**
 * @param {object} rule
 * @param {number} index
 * @param {number} total
 * @param {{ onChange: (next: object) => void, onRemove: () => void, onMove: (delta: number) => void }} handlers
 * @returns {HTMLElement}
 */
function renderRule(rule, index, total, handlers) {
  const update = (patch) => handlers.onChange({ ...rule, ...patch });
  const replaceStep = (stepIndex, next) => update({
    steps: rule.steps.map((step, i) => (i === stepIndex ? next : step)),
  });
  const removeStep = (stepIndex) => update({ steps: rule.steps.filter((_, i) => i !== stepIndex) });
  const moveStep = (stepIndex, delta) => {
    const target = stepIndex + delta;
    if (target < 0 || target >= rule.steps.length) return;
    const next = rule.steps.slice();
    [next[stepIndex], next[target]] = [next[target], next[stepIndex]];
    update({ steps: next });
  };

  return h('article.rule', {}, [
    h('header.rule-head', {}, [
      h('span.rule-rank', { text: String(index + 1) }),
      h('input.input.rule-name', {
        type: 'text',
        value: rule.label ?? '',
        placeholder: 'Rule name',
        'aria-label': `Rule ${index + 1} name`,
        onInput: (event) => update({ label: event.target.value }),
      }),
      h('div.ladder-tools', {}, [
        h('button.icon-btn', {
          type: 'button', text: '▲', title: 'Move up',
          'aria-label': `Move rule ${index + 1} up`,
          disabled: index === 0,
          onClick: () => handlers.onMove(-1),
        }),
        h('button.icon-btn', {
          type: 'button', text: '▼', title: 'Move down',
          'aria-label': `Move rule ${index + 1} down`,
          disabled: index === total - 1,
          onClick: () => handlers.onMove(1),
        }),
        h('button.icon-btn.icon-btn-danger', {
          type: 'button', text: '×', title: 'Remove this rule',
          'aria-label': `Remove rule ${index + 1}`,
          onClick: handlers.onRemove,
        }),
      ]),
    ]),

    h('div.rule-body', {}, [
      renderConditionTree(rule.match, (next) => update({ match: next }), { label: 'Applies when' }),

      h('div.rule-steps', {}, [
        h('p.field-label', { text: 'Steps, in order' }),
        ...rule.steps.map((step, stepIndex) => renderStep(step, stepIndex, rule.steps.length, {
          onChange: (next) => replaceStep(stepIndex, next),
          onRemove: () => removeStep(stepIndex),
          onMove: (delta) => moveStep(stepIndex, delta),
        })),
        h('button.btn.btn-ghost.cond-mini', {
          type: 'button',
          text: '+ Add a step',
          onClick: () => update({ steps: [...rule.steps, createStep()] }),
        }),
      ]),

      h('div.field', {}, [
        h('label.field-label', { text: 'When every step declines' }),
        h('select.input.select', {
          onChange: (event) => update({ fallback: event.target.value }),
        }, RULE_FALLBACKS.map((entry) => h('option', {
          value: entry.id,
          selected: entry.id === rule.fallback,
          text: `${entry.label} — ${entry.hint}`,
        }))),
      ]),
    ]),
  ]);
}

/**
 * @param {object} step
 * @param {number} index
 * @param {number} total
 * @param {{ onChange: (next: object) => void, onRemove: () => void, onMove: (delta: number) => void }} handlers
 * @returns {HTMLElement}
 */
function renderStep(step, index, total, handlers) {
  const update = (patch) => handlers.onChange({ ...step, ...patch });
  const needs = ACTION_NEEDS.get(step.action) ?? [];

  return h('div.step', {}, [
    h('div.step-head', {}, [
      h('span.step-rank', { text: `${index + 1}` }),
      h('select.input.select.step-action', {
        'aria-label': `Step ${index + 1} action`,
        onChange: (event) => update({ action: event.target.value }),
      }, STEP_ACTIONS.map((entry) => h('option', {
        value: entry.id,
        selected: entry.id === step.action,
        text: entry.label,
      }))),
      ...needs.map((need) => renderStepInput(need, step, update, index)),
      h('label.step-once', { title: 'Run this step at most once per battle' }, [
        h('input', {
          type: 'checkbox',
          checked: Boolean(step.once),
          'aria-label': `Step ${index + 1} runs once per battle`,
          onChange: (event) => update({ once: event.target.checked }),
        }),
        h('span', { text: 'once' }),
      ]),
      h('div.ladder-tools', {}, [
        h('button.icon-btn', {
          type: 'button', text: '▲', title: 'Move up',
          'aria-label': `Move step ${index + 1} up`,
          disabled: index === 0,
          onClick: () => handlers.onMove(-1),
        }),
        h('button.icon-btn', {
          type: 'button', text: '▼', title: 'Move down',
          'aria-label': `Move step ${index + 1} down`,
          disabled: index === total - 1,
          onClick: () => handlers.onMove(1),
        }),
        h('button.icon-btn.icon-btn-danger', {
          type: 'button', text: '×', title: 'Remove',
          'aria-label': `Remove step ${index + 1}`,
          onClick: handlers.onRemove,
        }),
      ]),
    ]),
    renderConditionTree(step.when, (next) => update({ when: next }), { label: 'Only when', depth: 1 }),
  ]);
}

/**
 * The action-specific input for a step.
 *
 * @param {string} need
 * @param {object} step
 * @param {(patch: object) => void} update
 * @param {number} index
 * @returns {HTMLElement | null}
 */
function renderStepInput(need, step, update, index) {
  switch (need) {
    case 'move':
      return h('input.input.step-input', {
        type: 'text',
        value: step.move ?? '',
        placeholder: 'Move name',
        'aria-label': `Step ${index + 1} move`,
        onInput: (event) => update({ move: event.target.value }),
      });

    case 'slot':
      return h('select.input.select.step-slot', {
        'aria-label': `Step ${index + 1} slot`,
        title: 'Which team member uses the move',
        onChange: (event) => {
          const value = event.target.value;
          update({ slot: value === 'auto' ? 'auto' : Number.parseInt(value, 10) });
        },
      }, [
        h('option', { value: 'auto', selected: step.slot === 'auto', text: 'any slot' }),
        ...[1, 2, 3, 4, 5, 6].map((slot) => h('option', {
          value: String(slot),
          selected: step.slot === slot,
          text: `slot ${slot}`,
        })),
      ]);

    case 'slotNumber':
      return h('select.input.select.step-slot', {
        'aria-label': `Step ${index + 1} slot`,
        onChange: (event) => update({ slotNumber: Number.parseInt(event.target.value, 10) }),
      }, [1, 2, 3, 4, 5, 6].map((slot) => h('option', {
        value: String(slot),
        selected: step.slotNumber === slot,
        text: `slot ${slot}`,
      })));

    case 'item':
      return h('input.input.step-input', {
        type: 'text',
        value: step.item ?? '',
        placeholder: 'Item name',
        'aria-label': `Step ${index + 1} item`,
        onInput: (event) => update({ item: event.target.value }),
      });

    case 'balls':
      return h('input.input.step-input.step-wide', {
        type: 'text',
        value: Array.isArray(step.balls) ? step.balls.join(', ') : '',
        placeholder: 'Ultra Ball, Great Ball, Pokeball',
        'aria-label': `Step ${index + 1} balls`,
        title: 'Thrown top to bottom until one is used',
        onChange: (event) => update({ balls: splitList(event.target.value) }),
      });

    case 'expr':
      return h('input.input.step-input.step-wide', {
        type: 'text',
        value: step.expr ?? '',
        placeholder: 'useItem("Repel")',
        'aria-label': `Step ${index + 1} Lua`,
        title: 'Emitted verbatim; anything it calls is checked against the API',
        onInput: (event) => update({ expr: event.target.value }),
      });

    default:
      return null;
  }
}
