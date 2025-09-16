// src/problems.ts

export const halfAdderCircuit = {
  gates: [
    { id: 'gate1', type: 'AND', inputs: ['A', 'B'], stage: 1 },
    { id: 'gate2', type: 'OR', inputs: ['A', 'B'], stage: 1 },
    { id: 'gate3', type: 'NOT', inputs: ['gate1'], stage: 2 },
    { id: 'gate4', type: 'AND', inputs: ['gate2', 'gate3'], stage: 3 }
  ],
  outputs: {
    C: 'gate1',
    S: 'gate4'
  }
};

// チュートリアル用の問題セットを定義
export const halfAdderProblems = [
  {
    circuit: halfAdderCircuit,
    inputAssignments: { A: false, B: false },
    expectedOutput: { C: false, S: false },
    isTutorial: true
  },
  {
    circuit: halfAdderCircuit,
    inputAssignments: { A: false, B: true },
    expectedOutput: { C: false, S: true },
    isTutorial: true
  },
  {
    circuit: halfAdderCircuit,
    inputAssignments: { A: true, B: false },
    expectedOutput: { C: false, S: true },
    isTutorial: false
  },
  {
    circuit: halfAdderCircuit,
    inputAssignments: { A: true, B: true },
    expectedOutput: { C: true, S: false },
    isTutorial: true
  }
];