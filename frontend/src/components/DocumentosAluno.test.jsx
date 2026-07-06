import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      ...actual.api,
      listarDocumentos: vi.fn().mockResolvedValue([
        { id: 1, categoria: 'saude', descricao: 'Laudo médico', nome_original: 'laudo.pdf', arquivo: '/uploads/a.pdf', criado_em: '2026-07-03 10:00', autor_nome: 'Coord' },
      ]),
      enviarDocumento: vi.fn().mockResolvedValue({}),
      removerDocumento: vi.fn().mockResolvedValue(null),
    },
  };
});

import DocumentosAluno from './DocumentosAluno.jsx';
import { api } from '../api.js';

describe('DocumentosAluno', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista documentos do aluno', async () => {
    render(<DocumentosAluno alunoId={1} podeGerenciar={false} />);
    expect(await screen.findByText('Laudo médico')).toBeInTheDocument();
    expect(api.listarDocumentos).toHaveBeenCalledWith(1);
  });

  it('sem gestão, não mostra o formulário de envio nem o botão remover', async () => {
    render(<DocumentosAluno alunoId={1} podeGerenciar={false} />);
    await screen.findByText('Laudo médico');
    expect(screen.queryByText(/Enviar documento/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remover/i })).not.toBeInTheDocument();
  });

  it('com gestão, mostra formulário e permite remover', async () => {
    render(<DocumentosAluno alunoId={1} podeGerenciar />);
    await screen.findByText('Laudo médico');
    expect(screen.getByRole('button', { name: /Enviar documento/i })).toBeInTheDocument();

    // confirma remoção
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /Remover/i }));
    await waitFor(() => expect(api.removerDocumento).toHaveBeenCalledWith(1));
  });
});
