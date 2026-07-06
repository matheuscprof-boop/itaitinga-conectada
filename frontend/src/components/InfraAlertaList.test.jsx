import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InfraAlertaList from './InfraAlertaList.jsx';

const alertas = [
  { id: 1, categoria: 'buraco', descricao: 'Cratera enorme', status: 'aberto', anonimo: 0, autor_nome: 'Maria', latitude: -3.97, longitude: -38.52, foto: null },
  { id: 2, categoria: 'lixo', descricao: 'Lixo acumulado', status: 'resolvido', anonimo: 1, autor_nome: null, latitude: null, longitude: null, foto: null },
];

describe('InfraAlertaList', () => {
  it('mostra vazio quando não há alertas', () => {
    render(<InfraAlertaList alertas={[]} />);
    expect(screen.getByText(/Nenhum alerta/i)).toBeInTheDocument();
  });

  it('renderiza autor e "Anônimo" conforme o alerta', () => {
    render(<InfraAlertaList alertas={alertas} />);
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.getByText('Anônimo')).toBeInTheDocument();
    expect(screen.getByText('Cratera enorme')).toBeInTheDocument();
  });

  it('sem gestão de status, não mostra o seletor de status', () => {
    render(<InfraAlertaList alertas={alertas} />);
    expect(screen.queryByText(/Alterar status/i)).not.toBeInTheDocument();
  });

  it('com gestão, chama onAtualizarStatus ao mudar o status', () => {
    const onAtualizarStatus = vi.fn();
    render(<InfraAlertaList alertas={alertas} podeGerenciarStatus onAtualizarStatus={onAtualizarStatus} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'em_andamento' } });
    expect(onAtualizarStatus).toHaveBeenCalledWith(1, 'em_andamento');
  });
});
