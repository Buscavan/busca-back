import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ViagemDto } from './dtos/viagem.dto';
import { UploadService } from 'src/upload/upload.service';
import { CidadesService } from 'src/cidades/cidades.service';
import { CreateCommentDto } from './dtos/create-comment.dto';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

@Injectable()
export class ViagemService {
  private readonly supabase;

  constructor(
    private readonly uploadService: UploadService,
    private readonly cidadesService: CidadesService,
  ) {
    const supabaseURL = process.env.SUPABASE_URL;
    const supabaseKEY = process.env.SUPABASE_KEY;
    this.supabase = createClient(supabaseURL, supabaseKEY, {
      auth: { persistSession: false },
    });
  }

  async createViagem(dto: ViagemDto, file: Express.Multer.File) {
    try {
      const uploadResult = await this.uploadService.upload(
        file,
        `${dto.veiculoId}-trip`,
      );
      const {
        data: { signedUrl },
        error: signedUrlError,
      } = await this.supabase.storage
        .from('buscavan')
        .createSignedUrl(uploadResult.data.path, 3155760000); // URL válida por 100 anos

      if (signedUrlError) {
        throw new Error(
          `Erro ao criar URL assinada: ${signedUrlError.message}`,
        );
      }

      const viagem = await prisma.viagem.create({
        data: {
          origem: { connect: { id: dto.origem.id } },
          destino: { connect: { id: dto.destino.id } },
          dataInicial: dto.dataInicial,
          dataFinal: dto.dataFinal,
          valor: dto.valor,
          localEmbarqueIda: dto.localEmbarqueIda,
          localEmbarqueVolta: dto.localEmbarqueVolta,
          fotoDestinoUrl: signedUrl,
          createdAt: dto.createdAt,
          descricao: dto.descricao,
          veiculo: { connect: { id: dto.veiculoId } },
          comentarios: dto.comentarios
            ? {
                create: dto.comentarios.map((comment) => ({
                  content: comment.content,
                  author: comment.author,
                  createdAt: comment.createdAt,
                  parentComment: comment.parentCommentId
                    ? { connect: { id: comment.parentCommentId } }
                    : undefined,
                })),
              }
            : undefined,
          usuario: { connect: { cpf: `"12312312312"` } }, // substituir pelo cpf do usuário autenticado
        },
      });
      return viagem;
    } catch (error) {
      console.error('Erro ao criar viagem:', error);
      throw error;
    }
  }

  async deleteViagem(id: number) {
    try {
      const viagem = await prisma.viagem.delete({
        where: {
          id: id,
        },
      });
      return viagem;
    } catch (error) {
      console.error('Erro ao deletar viagem:', error);
      throw error;
    }
  }

  async updateViagem(id: number, data: ViagemDto) {
    try {
      const updatedViagem = await prisma.viagem.update({
        where: {
          id: id,
        },
        data: {
          origem: data.origem ? { connect: { id: data.origem.id } } : undefined,
          destino: data.destino
            ? { connect: { id: data.destino.id } }
            : undefined,
          veiculo: data.veiculoId
            ? { connect: { id: data.veiculoId } }
            : undefined,
          localEmbarqueIda: data.localEmbarqueIda,
          localEmbarqueVolta: data.localEmbarqueVolta,
          valor: data.valor,
          fotoDestinoUrl: data.fotoDestinoUrl,
          dataInicial: data.dataInicial,
          dataFinal: data.dataFinal,
          descricao: data.descricao,
          comentarios: data.comentarios
            ? {
                upsert: data.comentarios.map((comment) => ({
                  where: { id: comment.id || 0 },
                  create: {
                    content: comment.content,
                    author: comment.author,
                    createdAt: comment.createdAt,
                    parentComment: comment.parentCommentId
                      ? { connect: { id: comment.parentCommentId } }
                      : undefined,
                  },
                  update: {
                    content: comment.content,
                    author: comment.author,
                    createdAt: comment.createdAt,
                    parentComment: comment.parentCommentId
                      ? { connect: { id: comment.parentCommentId } }
                      : undefined,
                  },
                })),
              }
            : undefined,
        },
      });
      return updatedViagem;
    } catch (error) {
      console.error('Erro ao atualizar viagem:', error);
      throw error;
    }
  }

  async findAllByMotoristaId(idMotorista: string) {
    try {
      const viagens = await prisma.viagem.findMany({
        where: { usuarioId: idMotorista },
      });
      return viagens;
    } catch (error) {
      console.error('Erro ao buscar viagens por motorista:', error);
      throw error;
    }
  }

  async findViagemById(id: number) {
    try {
      const viagem = await prisma.viagem.findUnique({
        where: { id },
        include: { comentarios: true, veiculo: true },
      });
      return viagem;
    } catch (error) {
      console.error('Erro ao buscar viagem por ID:', error);
      throw error;
    }
  }

  async addComment(id: number, comment: CreateCommentDto) {
    try {
      const newComment = await prisma.comment.create({
        data: {
          content: comment.content,
          author: comment.author,
          createdAt: new Date(),
          viagem: { connect: { id } },
          parentComment: comment.parentCommentId
            ? { connect: { id: comment.parentCommentId } }
            : undefined,
        },
      });
      return newComment;
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      throw error;
    }
  }

  async getCidades() {
    return this.cidadesService.getEstado();
  }

  async getVeiculoByPlaca(placa: string) {
    try {
      const veiculo = await prisma.veiculo.findUnique({
        where: { placa },
      });
      return veiculo;
    } catch (error) {
      console.error('Erro ao buscar veículo por placa:', error);
      throw error;
    }
  }

  async getEstados() {
    return this.cidadesService.getEstado();
  }

  async getCidadesByEstado(id: string, page: number, limit: number) {
    return this.cidadesService.getCidadesbyIdEstado(id, page, limit);
  }
}
