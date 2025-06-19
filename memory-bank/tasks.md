# VSCode Prompt Manager Extension - Environment-aware Feature Gating

## Task Status: 🎯 ACTIVE - PLANNING PHASE

## 🎯 TASK OVERVIEW

**Task**: Implement environment detection and feature gating for VS Code, Cursor, and Windserf
**Complexity Level**: Level 3 - Intermediate Feature  
**Priority**: Medium-High
**Estimated Effort**: Medium (5-8 implementation units)
**Start Date**: 2025-01-20

### Problem Description

The extension currently runs the same way across all editor environments (VS Code, Cursor, Windserf). We need to:

1. **Auto-detect** the host editor at runtime without user configuration
2. Provide **type-safe, centralized, testable** detection service
3. Expose environment information through DI container and VS Code context keys
4. Enable **environment-specific features** and behaviors
5. Maintain **backwards compatibility** with classic VS Code

### Requirements Analysis

#### Functional Requirements

- Auto-detect host editor (VS Code, Cursor, Windserf) at runtime
- Provide boolean checks (`isVSCode()`, `isCursor()`, `isWindserf()`)
- Expose detection through dependency injection
- Set VS Code context keys for `when` clauses in package.json
- Fallback to VS Code for unknown environments
- No user configuration required

#### Non-Functional Requirements

- Type-safe implementation with TypeScript
- Injectable singleton service pattern
- Unit tests for all environments
- Zero breaking changes to existing code
- Performance: O(1) detection after initialization

#### Technical Constraints

- Must integrate with existing DI container
- Must follow existing architectural patterns
- Must work across VS Code API variations
- Must be testable with mocked dependencies

## 📋 COMPONENTS AFFECTED

### New Components (To Create)

- `src/infrastructure/config/environment.ts` - Type definitions and contracts
- `src/infrastructure/config/EnvironmentDetector.ts` - Implementation service
- `src/test/environmentDetector.test.ts` - Unit tests for all scenarios

### Existing Components (To Modify)

- `src/infrastructure/di/di-tokens.ts` - Add EnvironmentDetector token
- `src/infrastructure/di/di-container.ts` - Register singleton service
- `src/extension/extension.ts` - Set context keys during initialization

### Integration Points

- **DI Container**: Register as singleton service
- **VS Code Context**: Set context keys for command visibility
- **Extension Activation**: Initialize during startup
- **Testing Framework**: Mock vscode.env for different environments

## 🏗️ ARCHITECTURE CONSIDERATIONS

### Service Design Pattern

- **Interface Segregation**: `EnvironmentDetector` interface defines contract
- **Dependency Injection**: Injectable singleton with `@injectable` decorator
- **Single Responsibility**: Only handles environment detection
- **Immutable State**: Environment detected once at initialization

### Integration Strategy

- **Non-invasive**: Existing code unchanged unless it opts-in
- **Discoverable**: Available through DI container to any service
- **Extensible**: Easy to add new environments (extend enum + detection logic)

### Testing Strategy

- **Isolation**: Mock `vscode.env` for different scenarios
- **Coverage**: Test all three environments plus edge cases
- **Reliability**: Fallback behavior for unknown environments

## 📝 IMPLEMENTATION STRATEGY

### Phase 1: Core Infrastructure (2-3 units)

1. Create environment type definitions and service interface
2. Implement EnvironmentDetector service with detection logic
3. Add DI container integration (token + registration)

### Phase 2: VS Code Integration (1-2 units)

1. Initialize service in extension activation
2. Set context keys for environment-specific commands
3. Test context key functionality

### Phase 3: Testing & Quality (2-3 units)

1. Create comprehensive unit tests for all environments
2. Test DI container integration
3. Verify context keys are set correctly
4. Test fallback behavior for unknown environments

## 🔢 DETAILED IMPLEMENTATION STEPS

### Step 1: Environment Type System

```typescript
// src/infrastructure/config/environment.ts
export enum Environment {
  VSCode = "vscode",
  Cursor = "cursor",
  Windserf = "windserf",
}

export interface EnvironmentDetector {
  getEnvironment(): Environment;
  isVSCode(): boolean;
  isCursor(): boolean;
  isWindserf(): boolean;
}
```

### Step 2: Detection Service

```typescript
// src/infrastructure/config/EnvironmentDetector.ts
@injectable()
export class EnvironmentDetectorImpl implements EnvironmentDetector {
  private readonly env: Environment = this.detect();

  private detect(): Environment {
    const host = (vscode.env as any).appHost ?? vscode.env.appName ?? "";
    const name = host.toLowerCase();

    if (name.includes("cursor")) return Environment.Cursor;
    if (name.includes("windserf")) return Environment.Windserf;
    return Environment.VSCode; // fallback
  }
}
```

### Step 3: DI Integration

- Add `EnvironmentDetector: Symbol("EnvironmentDetector")` to di-tokens.ts
- Register `EnvironmentDetectorImpl` as singleton in di-container.ts

### Step 4: Context Keys

```typescript
// In extension.ts activation
const envDetector = container.resolve<EnvironmentDetector>(
  DI_TOKENS.EnvironmentDetector
);
vscode.commands.executeCommand(
  "setContext",
  "promptManager.isCursor",
  envDetector.isCursor()
);
vscode.commands.executeCommand(
  "setContext",
  "promptManager.isWindserf",
  envDetector.isWindserf()
);
```

### Step 5: Comprehensive Testing

- Mock `vscode.env.appName` for each environment
- Test detection logic with various host strings
- Verify boolean methods return correct values
- Test DI container resolution
- Test context key setting

## 🔄 DEPENDENCIES

### Internal Dependencies

- Existing DI container (`src/infrastructure/di/`)
- VS Code API (`vscode` module)
- TSyringe dependency injection (`@injectable`, `container`)

### External Dependencies

- No new external dependencies required
- Leverages existing testing framework (Jest)

### Development Dependencies

- TypeScript compilation
- ESLint compliance
- Jest test runner

## ⚠️ CHALLENGES & MITIGATIONS

### Challenge 1: Environment Detection Reliability

**Risk**: Editor brand names might change or be inconsistent
**Mitigation**:

- Use multiple detection methods (`appHost`, `appName`)
- Implement fallback to VS Code for unknown environments
- Comprehensive test coverage for edge cases

### Challenge 2: VS Code API Variations

**Risk**: Different editors might expose VS Code API differently
**Mitigation**:

- Use optional chaining and nullish coalescing
- Test with actual editor environments where possible
- Graceful degradation for missing properties

### Challenge 3: Context Key Timing

**Risk**: Context keys might not be set before commands are registered
**Mitigation**:

- Set context keys early in activation process
- Document initialization order requirements
- Test context key availability

### Challenge 4: Testing Editor Environments

**Risk**: Hard to test actual behavior in Cursor/Windserf
**Mitigation**:

- Extensive mocking in unit tests
- Manual testing procedures for each environment
- Community feedback for environment-specific issues

## 🎨 CREATIVE PHASE COMPONENTS

**No Creative Phase Required** - This is a well-defined technical implementation with:

- Clear API surface from technical design
- Established patterns (DI, VS Code context keys)
- No UI/UX design decisions needed
- No complex algorithm design required

## ✅ VERIFICATION CHECKLIST

### Functional Verification

- [ ] Environment detection works for VS Code
- [ ] Environment detection works for Cursor
- [ ] Environment detection works for Windserf
- [ ] Fallback to VS Code for unknown environments
- [ ] Boolean helper methods return correct values
- [ ] DI container resolves service correctly

### Integration Verification

- [ ] VS Code context keys are set correctly
- [ ] Service available through DI container
- [ ] No breaking changes to existing functionality
- [ ] Extension activates successfully in all environments

### Quality Verification

- [ ] Unit tests pass for all environments
- [ ] TypeScript compilation succeeds
- [ ] ESLint rules pass
- [ ] Code coverage meets project standards
- [ ] Documentation updated

## 📊 SUCCESS METRICS

- **Detection Accuracy**: 100% correct environment identification
- **API Coverage**: All three environments supported
- **Test Coverage**: >95% code coverage for new components
- **Integration Success**: Zero breaking changes to existing features
- **Performance**: Detection completes in <1ms after service initialization

## 🎯 NEXT MODE RECOMMENDATION

**IMPLEMENT MODE** - No creative phases required. Ready for direct implementation following the detailed technical plan.

---

## Status Checklist

- [x] **Initialization**: Task defined and complexity assessed
- [x] **Planning**: Comprehensive implementation plan created
- [ ] **Implementation**: Code implementation
- [ ] **Testing**: Unit tests and integration verification
- [ ] **Reflection**: Lessons learned documentation
- [ ] **Archiving**: Archive document creation
