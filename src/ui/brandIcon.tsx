/**
 * Icono de marca para una credencial.
 *
 * Pinta el logo monocromo (set curado en `brandData.ts`, extraído de
 * simple-icons) sobre un círculo del color de la marca. Si no hay coincidencia,
 * muestra un avatar con la inicial. La resolución vive en `brandResolve.ts`
 * (pura, testeada).
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { avatarColor, luminance, resolveBrand } from './brandResolve';

export function BrandIcon({
  title,
  url,
  size = 44,
}: {
  title: string;
  url?: string | null;
  size?: number;
}) {
  const brand = resolveBrand(title, url);
  const radius = size / 2;

  if (brand) {
    const fg = luminance(brand.hex) > 0.62 ? '#111111' : '#FFFFFF';
    const logo = Math.round(size * 0.56);
    return (
      <View style={[styles.circle, { width: size, height: size, borderRadius: radius, backgroundColor: `#${brand.hex}` }]}>
        <Svg width={logo} height={logo} viewBox="0 0 24 24">
          <Path d={brand.path} fill={fg} />
        </Svg>
      </View>
    );
  }

  const letter = (title.trim()[0] ?? '?').toUpperCase();
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: radius, backgroundColor: avatarColor(title) }]}>
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: Math.round(size * 0.42) }}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
