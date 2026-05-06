-- ============================================================================
-- Seed inicial — ejecutar DESPUÉS de crear el usuario admin en Supabase Auth.
--
-- Pasos:
--   1. En el dashboard de Supabase ve a Authentication → Users → "Add user"
--   2. Crea el usuario con tu email y contraseña
--   3. Copia el UUID que aparece en la columna "User UID"
--   4. Reemplaza 'TU-UUID-AQUI' y 'admin@soltegra.es' con tus datos
--   5. Ejecuta este script: npx supabase db execute --file supabase/seed.sql
-- ============================================================================

do $$
declare
  admin_uuid uuid := 'ec6a94e4-abb0-48d6-a0ea-686909907598';   -- <-- reemplaza esto
begin
  -- Perfil admin
  insert into public.profiles (id, role, full_name)
  values (admin_uuid, 'admin', 'Admin Soltegra')
  on conflict (id) do update set role = 'admin';

  raise notice 'Admin profile created for %', admin_uuid;
end $$;

-- Schema de formulario por defecto (versión 1)
insert into public.form_schemas (version, is_current, is_draft, schema)
values (
  1,
  true,
  false,
  '{
    "sections": [
      {
        "id": "vivienda",
        "title": "Datos de la vivienda",
        "description": "Información básica del inmueble para tramitar el certificado.",
        "fields": [
          {"key": "direccion", "label": "Dirección completa", "type": "text", "required": true, "placeholder": "Calle, número, piso, puerta, código postal, municipio"},
          {"key": "referencia_catastral", "label": "Referencia catastral", "type": "text", "required": true, "helpText": "20 caracteres. Puedes consultarla en sedecatastro.gob.es", "maxLength": 20},
          {"key": "tipo_vivienda", "label": "Tipo de inmueble", "type": "select", "required": true, "options": ["Piso", "Vivienda unifamiliar", "Local comercial", "Edificio completo"]},
          {"key": "superficie_m2", "label": "Superficie útil", "type": "number", "required": true, "min": 1, "step": 0.1, "unit": "m²"},
          {"key": "ano_construccion", "label": "Año de construcción", "type": "number", "required": true, "min": 1800, "max": 2100},
          {"key": "numero_plantas", "label": "Número de plantas", "type": "number", "min": 1},
          {"key": "tiene_garaje", "label": "¿Dispone de garaje?", "type": "checkbox"},
          {"key": "observaciones", "label": "Observaciones adicionales", "type": "textarea", "rows": 4, "placeholder": "Cualquier dato relevante (reformas recientes, ascensor, etc.)"}
        ]
      },
      {
        "id": "instalaciones",
        "title": "Instalaciones térmicas",
        "fields": [
          {"key": "tipo_calefaccion", "label": "Sistema de calefacción", "type": "select", "options": ["Caldera de gas natural", "Caldera de gasoil", "Caldera de biomasa", "Bomba de calor", "Radiadores eléctricos", "Suelo radiante", "No tiene", "Otro"]},
          {"key": "tipo_acs", "label": "Sistema de agua caliente sanitaria", "type": "select", "options": ["Caldera mixta", "Termo eléctrico", "Solar térmica", "Bomba de calor", "Otro"]},
          {"key": "tiene_aire_acondicionado", "label": "¿Tiene aire acondicionado?", "type": "checkbox"}
        ]
      },
      {
        "id": "documentacion",
        "title": "Documentación",
        "description": "Sube los documentos y fotografías necesarios para emitir el certificado.",
        "files": [
          {"key": "escritura_o_nota_simple", "label": "Escritura o nota simple registral", "accept": ["application/pdf", "image/*"], "required": true, "maxSizeMb": 15},
          {"key": "fotos_fachada", "label": "Fotografías de la fachada", "accept": ["image/*"], "multiple": true, "required": true, "minCount": 2, "maxCount": 6, "maxSizeMb": 10, "helpText": "Mínimo 2 fotos desde diferentes ángulos."},
          {"key": "fotos_interior", "label": "Fotografías del interior", "accept": ["image/*"], "multiple": true, "minCount": 2, "maxCount": 12, "maxSizeMb": 10, "helpText": "Salón, cocina, dormitorios y baños."},
          {"key": "fotos_caldera_aire", "label": "Fotografías de calderas / aire acondicionado", "accept": ["image/*"], "multiple": true, "maxCount": 6, "maxSizeMb": 10, "helpText": "Incluye placa de características si es posible."},
          {"key": "planos", "label": "Planos (si dispone)", "accept": ["application/pdf", "image/*"], "multiple": true, "maxCount": 5, "maxSizeMb": 15}
        ]
      }
    ]
  }'::jsonb
)
on conflict (version) do nothing;
