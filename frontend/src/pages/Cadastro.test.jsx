import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mocka a API preservando ROTULOS (usado para os rótulos de perfil).
vi.mock('../api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      ...actual.api,
      listarEscolasPublicas: vi.fn().mockResolvedValue([{ id: 1, nome: 'Escola A' }]),
      registrar: vi.fn().mockResolvedValue({ pendente: true, mensagem: 'Conta criada.' }),
    },
  };
});

import Cadastro from './Cadastro.jsx';
import { api } from '../api.js';

describe('Cadastro (autocadastro)', () => {
  it('não mostra seletor de escola para cidadão', async () => {
    render(<Cadastro onVoltar={() => {}} />);
    await waitFor(() => expect(api.listarEscolasPublicas).toHaveBeenCalled());
    expect(screen.queryByLabelText(/^Escola$/i)).not.toBeInTheDocument();
  });

  it('mostra seletor de escola ao escolher perfil de equipe', async () => {
    render(<Cadastro onVoltar={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Eu sou/i), { target: { value: 'professor' } });
    expect(await screen.findByLabelText(/^Escola$/i)).toBeInTheDocument();
    expect(screen.getByText('Escola A')).toBeInTheDocument();
  });

  it('exige escola para equipe antes de enviar', async () => {
    render(<Cadastro onVoltar={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Eu sou/i), { target: { value: 'professor' } });
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Prof' } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: 'p@e.com' } });
    // /^Senha/i evita casar com o aria-label "Mostrar senha" do botão olhinho.
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: 'senha123' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar conta/i }));
    expect(await screen.findByText(/Selecione a escola/i)).toBeInTheDocument();
    expect(api.registrar).not.toHaveBeenCalled();
  });
});
