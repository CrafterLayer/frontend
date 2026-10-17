// @craftkit/builder-react — React bindings for the builder kernel (layer 2).
// Rendering lives in @craftkit/builder-renderer; composition lives in the preset.

export { BuilderProvider, type BuilderProviderProps } from './components/BuilderProvider';
export { Slot, type SlotProps } from './components/Slot';

export { useBuilder } from './hooks/use-builder';
export { useDispatch } from './hooks/use-dispatch';
export { useNode } from './hooks/use-node';
export { useRegistryVersion } from './hooks/use-registry-version';
export { useSelection } from './hooks/use-selection';
