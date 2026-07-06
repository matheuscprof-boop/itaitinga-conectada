import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from './Badge.jsx';

describe('Badge', () => {
  it('mostra o rótulo legível do valor', () => {
    render(<Badge tipo="nivel" valor="alto" />);
    expect(screen.getByText('Alto')).toBeInTheDocument();
  });

  it('aplica a classe correspondente ao tipo e valor', () => {
    const { container } = render(<Badge tipo="status" valor="em_andamento" />);
    expect(container.firstChild).toHaveClass('badge');
    expect(container.firstChild).toHaveClass('badge--status-em_andamento');
  });

  it('usa o próprio valor quando não há rótulo mapeado', () => {
    render(<Badge tipo="nivel" valor="desconhecido" />);
    expect(screen.getByText('desconhecido')).toBeInTheDocument();
  });
});
