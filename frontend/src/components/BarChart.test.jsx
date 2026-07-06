import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BarChart from './BarChart.jsx';

describe('BarChart', () => {
  it('renderiza um item por dado, com rótulo e valor', () => {
    render(
      <BarChart
        dados={[
          { rotulo: 'Frequência', valor: 3 },
          { rotulo: 'Desempenho', valor: 1 },
        ]}
      />
    );
    expect(screen.getByText('Frequência')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Desempenho')).toBeInTheDocument();
  });

  it('mostra uma mensagem quando não há dados', () => {
    render(<BarChart dados={[]} />);
    expect(screen.getByText('Sem dados.')).toBeInTheDocument();
  });

  it('calcula a largura das barras proporcional ao maior valor', () => {
    const { container } = render(
      <BarChart
        dados={[
          { rotulo: 'A', valor: 5 },
          { rotulo: 'B', valor: 10 },
        ]}
      />
    );
    const barras = container.querySelectorAll('.barra-preenchida');
    expect(barras[0].style.width).toBe('50%');
    expect(barras[1].style.width).toBe('100%');
  });
});
