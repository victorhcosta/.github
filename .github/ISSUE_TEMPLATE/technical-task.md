---
name: Technical Task
about: Implementation detail
labels: task
---

# 🔧 Task Title

## 🎯 Objective

Clear technical goal.

---

## 📍 Scope

What exactly must be done?

- 
- 
- 

---

## 📘 Rules and Behavior

Describe non-negotiable implementation rules and expected runtime behavior.

Examples:

- Validation and business constraints that must always be enforced
- Idempotency or retry behavior for async/queue operations
- Logging, observability, and security requirements

---

## 🌐 Error Mapping and i18n

Define the error contract and language strategy for this task.

- Error contract: `code`, `message`, `details`, `traceId`, `timestamp`
- Languages: `pt-BR`, `en`, `es`
- Expected mapping by scenario (validation, conflict, not-found, unauthorized, unexpected)

Example:

> For invalid input, return `VALIDATION_ERROR` with localized `message` and field-level `details`.

---

## 🧪 Validation Checklist

How do we know this is complete?

- [ ] Tests passing
- [ ] No warnings
- [ ] Logs validated
- [ ] Code reviewed

---

## ⚠️ Risks

- 
- 
- 

---

## 📎 Related

Epic: #EpicNumber
Feature: #FeatureNumber
