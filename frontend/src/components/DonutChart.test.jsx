import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DonutChart from './DonutChart.jsx';

describe('DonutChart', () => {
  it('mostra o total no centro e os percentuais na legenda', () => {
    render(<DonutChart dados={[{ rotulo: 'A', valor: 3 }, { rotulo: 'B', valor: 1 }]} />);
    expect(screen.getByText('4')).toBeInTheDocument(); // total
    expect(screen.getByText('3 (75%)')).toBeInTheDocument();
    expect(screen.getByText('1 (25%)')).toBeInTheDocument();
  });

  it('mostra mensagem quando tudo é zero', () => {
    render(<DonutChart dados={[{ rotulo: 'A', valor: 0 }]} />);
    expect(screen.getByText('Sem dados.')).toBeInTheDocument();
  });
});
