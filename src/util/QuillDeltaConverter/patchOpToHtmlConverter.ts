import { OpToHtmlConverter } from 'quill-delta-to-html/dist/commonjs/OpToHtmlConverter'

const originalGetCssClasses = OpToHtmlConverter.prototype.getCssClasses
const originalGetTagAttributes = OpToHtmlConverter.prototype.getTagAttributes

OpToHtmlConverter.prototype.getCssClasses = function getCssClasses() {
    const originalCssClasses = originalGetCssClasses.apply(this)
    const self = this as any

    if (typeof self.options.getCssClassesForOp === 'function') {
        const additionalClasses = self.options.getCssClassesForOp(self.op)
        return originalCssClasses.concat(additionalClasses)
    }
    return originalCssClasses
}

OpToHtmlConverter.prototype.getTagAttributes = function getTagAttributes() {
    let originalTagAttributes = originalGetTagAttributes.apply(this)

    const self = this as any

    if (self.op.attributes.code) {
        const classes = this.getCssClasses()
        if (classes.length > 0) {
            const classesAttr = [{ key: 'class', value: classes.join(' ') }]
            originalTagAttributes = originalTagAttributes.concat(classesAttr)
        }
    }

    return originalTagAttributes
}
