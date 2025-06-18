# Creative Phase: Drag and Drop UI/UX Design

🎨🎨🎨 **ENTERING CREATIVE PHASE: UI/UX DESIGN** 🎨🎨🎨

**Date**: 2025-01-18  
**Component**: Drag and Drop Visual Feedback and User Experience  
**Phase Type**: UI/UX Design  
**Status**: In Progress

## 📋 PROBLEM STATEMENT

**Challenge**: Design intuitive visual feedback and user experience for drag-and-drop functionality in the VSCode tree view that allows users to move prompt files between folders and to the root directory.

**Key Questions**:

- How should files look and behave during drag operations?
- How should drop targets (folders and root) provide visual feedback?
- What visual cues indicate valid vs invalid drop zones?
- How should we handle edge cases like conflicts and errors?
- How can we maintain consistency with VSCode's design language?

**User Requirements**:

- Clear visual indication when dragging begins
- Obvious drop target highlighting
- Feedback for valid/invalid drop zones
- Progress indication during file operations
- Error state handling with clear messaging

## 🎨 DESIGN CONSTRAINTS & CONTEXT

**Style Guide Reference**: Using project style guide from `memory-bank/style-guide.md`

- **Naming**: camelCase for variables, kebab-case for CSS classes
- **Consistency**: Must align with VSCode extension patterns
- **Accessibility**: WCAG AA compliance required
- **Technology**: VSCode TreeView API, VSCode ThemeIcons, CSS styling

**Technical Constraints**:

- Limited to VSCode TreeView API capabilities
- Must work with existing FileTreeItem and FolderTreeItem components
- Cannot modify VSCode's native drag-and-drop visual feedback extensively
- Must maintain performance during drag operations

## 🔍 UI/UX OPTIONS ANALYSIS

### Option 1: Minimal VSCode-Native Approach

**Description**: Use VSCode's built-in drag-and-drop styling with minimal custom enhancements

**Pros**:

- Consistent with VSCode native experience
- Low implementation complexity
- Automatic theme integration (light/dark mode)
- Better performance (no custom styling overhead)
- Familiar to VSCode users

**Cons**:

- Limited customization options
- May lack clear drop zone indicators
- Minimal progress feedback during operations
- Less distinctive visual states

**Complexity**: Low  
**Implementation Time**: 1-2 days  
**Accessibility**: High (VSCode handles most concerns)

### Option 2: Enhanced Visual Feedback System

**Description**: Custom visual enhancements with drag shadows, drop zone highlighting, and progress indicators

**Pros**:

- Clear visual hierarchy and feedback
- Distinctive drag and drop states
- Better user guidance through visual cues
- Progress indicators for long operations
- Can handle complex scenarios (conflicts, errors)

**Cons**:

- Higher implementation complexity
- Potential performance impact
- Need to handle theme variations manually
- Risk of inconsistency with VSCode patterns

**Complexity**: Medium-High  
**Implementation Time**: 3-5 days  
**Accessibility**: Medium (requires custom ARIA support)

### Option 3: Hybrid Approach with Progressive Enhancement

**Description**: Start with VSCode native styling, progressively enhance with custom feedback where most beneficial

**Pros**:

- Best of both worlds - native consistency + enhanced UX
- Can be implemented incrementally
- Lower risk (fallback to native behavior)
- Focus enhancements on high-value interactions
- Easier to maintain and debug

**Cons**:

- Slightly more complex implementation planning
- Need to carefully balance native vs custom elements
- Requires good understanding of VSCode styling system

**Complexity**: Medium  
**Implementation Time**: 2-4 days  
**Accessibility**: High (leverages VSCode base + targeted enhancements)

## 🎯 DESIGN DECISION

**Selected Option**: **Option 3: Hybrid Approach with Progressive Enhancement**

**Rationale**:

1. **User Experience**: Provides intuitive drag-and-drop with clear visual feedback while maintaining VSCode familiarity
2. **Technical Feasibility**: Balances implementation complexity with user value
3. **Maintainability**: Easier to test, debug, and evolve incrementally
4. **Risk Management**: Fallback to native behavior reduces implementation risk
5. **Accessibility**: Builds on VSCode's accessibility foundation

## 📐 DETAILED UI/UX SPECIFICATIONS

### 1. Drag State Visual Design

**File Item During Drag**:

- **Opacity**: Reduce to 0.6 to indicate "ghost" state
- **Icon**: Add subtle drag cursor overlay using VSCode ThemeIcon
- **Text**: Keep readable but with reduced contrast
- **Border**: Optional subtle outline to maintain item boundaries

```typescript
// FileTreeItem drag state styling
interface DragState {
  opacity: 0.6;
  cursor: "grabbing";
  iconOverlay: 'vscode.ThemeIcon("grabber")';
  className: "prompt-file-dragging";
}
```

### 2. Drop Target Highlighting

**Folder Drop Targets**:

- **Background**: Subtle highlight using VSCode theme colors
- **Border**: 2px dashed border in accent color
- **Icon**: Temporarily replace with "folder-open" during hover
- **Animation**: Gentle pulse effect (0.8s cycle)

**Root Directory Drop Target**:

- **Indicator**: Top-level visual indicator (thin line or zone)
- **Color**: Use VSCode's "list.highlightForeground" theme color
- **Position**: Above first item or as distinct root zone

```typescript
// FolderTreeItem drop target styling
interface DropTargetState {
  backgroundColor: "var(--vscode-list-hoverBackground)";
  border: "2px dashed var(--vscode-focusBorder)";
  borderRadius: "4px";
  animation: "gentle-pulse 0.8s ease-in-out infinite alternate";
}
```

### 3. Visual Feedback States

**Valid Drop Zone**:

- Green-tinted highlight using `--vscode-charts-green`
- Check icon overlay on folder
- Smooth transition animations (200ms)

**Invalid Drop Zone**:

- Red-tinted highlight using `--vscode-errorForeground`
- "X" or "blocked" icon overlay
- Subtle shake animation to indicate rejection

**Progress States**:

- Loading spinner overlay during file operations
- Progress toast notification for operations >500ms
- Success/error toast messages

### 4. Interaction Patterns

**Drag Initiation**:

1. Mouse down on file item for 100ms (prevents accidental drags)
2. Visual feedback begins immediately
3. Cursor changes to grabbing state

**Drop Target Detection**:

1. Hover over folder for 200ms triggers highlight
2. Visual feedback updates dynamically
3. Invalid targets show rejection state immediately

**Drop Completion**:

1. Visual confirmation (brief green flash)
2. Tree refresh with new item location
3. Focus moves to item in new location

## 🧩 COMPONENT INTEGRATION PLAN

### Modified Components

**FileTreeItem Enhancements**:

```typescript
interface FileTreeItemState {
  isDragging: boolean;
  dragStartTime?: number;
  originalPosition?: { parent: string; index: number };
}
```

**FolderTreeItem Enhancements**:

```typescript
interface FolderTreeItemState {
  isDropTarget: boolean;
  dropHoverTime?: number;
  dropValidation: "valid" | "invalid" | "pending";
}
```

**PromptTreeProvider Additions**:

```typescript
interface DragDropState {
  activeDragItem?: FileTreeItem;
  activeDropTarget?: FolderTreeItem;
  operation: "move" | "copy" | null;
  feedback: OperationFeedback;
}
```

## ♿ ACCESSIBILITY CONSIDERATIONS

1. **Screen Reader Support**:

   - ARIA labels for drag states ("Moving [filename]")
   - ARIA live regions for drop target changes
   - Audible feedback for successful operations

2. **Keyboard Navigation**:

   - Keyboard-only drag-and-drop alternative (Cut/Paste)
   - Focus management during operations
   - Escape key to cancel drag operations

3. **High Contrast Mode**:
   - Ensure borders and highlights are visible
   - Use pattern overlays in addition to color
   - Test with Windows High Contrast themes

## 🎨 VISUAL MOCKUPS (Conceptual)

```
[Normal State]
📁 Folder Name (3 prompts)
📄 Prompt File 1
📄 Prompt File 2

[Drag State - File Being Dragged]
📁 Folder Name (3 prompts)
📄 Prompt File 1 [opacity: 0.6, grabbing cursor]
📄 Prompt File 2

[Drop Target State - Folder Highlighted]
📁 Folder Name (3 prompts) [dashed border, highlighted background]
📄 Prompt File 2

[Invalid Drop State]
📄 Prompt File 1 [red tint, blocked cursor]
```

## ✅ VALIDATION CHECKLIST

- [x] **User Experience**: Clear visual hierarchy and feedback
- [x] **Accessibility**: WCAG AA compliance planned
- [x] **Technical Feasibility**: Uses VSCode TreeView APIs appropriately
- [x] **Consistency**: Aligns with VSCode design patterns
- [x] **Performance**: Minimal impact on tree rendering
- [x] **Style Guide**: Follows project naming and structure conventions
- [x] **Progressive Enhancement**: Graceful fallback to native behavior

## 🚀 IMPLEMENTATION GUIDELINES

1. **Phase 1**: Implement basic drag states with opacity changes
2. **Phase 2**: Add drop target highlighting for folders
3. **Phase 3**: Implement visual feedback for valid/invalid states
4. **Phase 4**: Add progress indicators and error handling
5. **Phase 5**: Enhance with accessibility features and testing

**Key Files to Modify**:

- `src/features/prompt-manager/ui/tree/items/FileTreeItem.ts`
- `src/features/prompt-manager/ui/tree/items/FolderTreeItem.ts`
- `src/features/prompt-manager/ui/tree/PromptTreeProvider.ts`
- CSS styles (embedded in components or separate stylesheet)

🎨🎨🎨 **EXITING CREATIVE PHASE - UI/UX DECISION MADE** 🎨🎨🎨

**Result**: Hybrid approach with progressive enhancement selected for optimal balance of user experience, technical feasibility, and maintainability.
