import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Heatmap from './Heatmap.jsx';

describe('Heatmap', () => {
  const props = {
    linhas: ['frequencia', 'desempenho'],
    colunas: ['9A', '8B'],
    celulas: { frequencia: { '9A': 2 }, desempenho: { '8B': 5 } },
    rotuloLinha: (v) => v.toUpperCase(),
  };

  it('renderiza os cabeçalhos e os valores das células', () => {
    render(<Heatmap {...props} />);
    expect(screen.getByText('FREQUENCIA')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('mostra travessão em células sem valor', () => {
    render(<Heatmap {...props} />);
    // frequencia×8B e desempenho×9A não têm valor → "—"
    expect(screen.getAllByText('—').length).toBe(2);
  });

  it('avisa quando não há dados', () => {
    render(<Heatmap linhas={[]} colunas={[]} celulas={{}} />);
    expect(screen.getByText('Sem dados para o mapeamento.')).toBeInTheDocument();
  });
});
