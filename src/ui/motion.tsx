/**
 * Animaciones suaves con la API `Animated` nativa de React Native (sin
 * dependencias extra). Entradas con fade + desplazamiento y una pulsación de
 * escala reutilizable.
 */
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

/** Entrada con fade-in + ligero desplazamiento vertical. Ideal para tarjetas/listas. */
export function FadeSlideIn({
  children,
  delay = 0,
  offset = 10,
  duration = 280,
  style,
}: {
  children: ReactNode;
  delay?: number;
  offset?: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [v, delay, duration]);

  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Escala de entrada tipo "pop" (para iconos/heros). */
export function PopIn({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 });
    anim.start();
    return () => anim.stop();
  }, [v]);
  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
