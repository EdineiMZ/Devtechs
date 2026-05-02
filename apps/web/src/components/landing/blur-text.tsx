'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

type Props = {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  startDelay?: number;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
};

export function BlurText({
  text,
  className = '',
  style,
  delay = 0.06,
  startDelay = 0,
  as: Tag = 'h2',
}: Props) {
  const ref    = useRef<HTMLElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, amount: 0.3 });
  const words  = text.split(' ');

  return (
    <Tag ref={ref as React.RefObject<HTMLHeadingElement>} className={`inline ${className}`} style={style} aria-label={text}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: startDelay + i * delay }}
          className="inline-block mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
}
