"""historial de estados de pedidos

Revision ID: 9695913d040d
Revises: 197b4a37879d
Create Date: 2026-07-15 17:16:08.014076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9695913d040d'
down_revision: Union[str, None] = '197b4a37879d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('pedido_estado_historial',
    sa.Column('pedido_id', sa.Uuid(), nullable=False),
    sa.Column('estado_anterior', sa.String(length=20), nullable=True),
    sa.Column('estado_nuevo', sa.String(length=20), nullable=False),
    sa.Column('origen', sa.String(length=20), nullable=False),
    sa.Column('actor_id', sa.Uuid(), nullable=True),
    sa.Column('nota', sa.Text(), nullable=True),
    sa.Column('referencia', sa.String(length=120), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['actor_id'], ['usuarios.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['pedido_id'], ['pedidos.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pedido_estado_historial_actor_id'), 'pedido_estado_historial', ['actor_id'], unique=False)
    op.create_index(op.f('ix_pedido_estado_historial_pedido_id'), 'pedido_estado_historial', ['pedido_id'], unique=False)

    # Backfill: los pedidos que ya existían no tienen historial y su línea de
    # tiempo saldría vacía. Solo se conoce su estado actual, no cómo llegó ahí,
    # así que se asienta un único punto de partida en vez de inventar
    # transiciones que nunca se registraron.
    op.execute(
        """
        INSERT INTO pedido_estado_historial (
            id, pedido_id, estado_anterior, estado_nuevo, origen, nota,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(), p.id, NULL, p.estado, 'sistema',
            'Estado al momento de migrar; no se conserva el historial previo',
            p.created_at, p.created_at
        FROM pedidos p
        """
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_pedido_estado_historial_pedido_id'), table_name='pedido_estado_historial')
    op.drop_index(op.f('ix_pedido_estado_historial_actor_id'), table_name='pedido_estado_historial')
    op.drop_table('pedido_estado_historial')
