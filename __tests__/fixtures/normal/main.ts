import * as stylex from '@stylexjs/stylex'

import * as blue from './blue'
import * as red from './red'

const { className } = stylex.props(blue.styles.blue, red.styles.red)

export { className }
