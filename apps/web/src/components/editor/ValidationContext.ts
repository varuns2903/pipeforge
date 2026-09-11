import { createContext, useContext } from 'react';

export interface NodeValidationState {
  nodeErrors: Record<string, string[]>;
  nodeWarnings: Record<string, string[]>;
}

const EMPTY: NodeValidationState = { nodeErrors: {}, nodeWarnings: {} };

export const ValidationContext = createContext<NodeValidationState>(EMPTY);
export const useNodeValidation = (nodeId: string) => {
  const { nodeErrors, nodeWarnings } = useContext(ValidationContext);
  return { errors: nodeErrors[nodeId] || [], warnings: nodeWarnings[nodeId] || [] };
};
