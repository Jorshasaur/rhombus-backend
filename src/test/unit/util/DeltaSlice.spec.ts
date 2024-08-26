import * as Delta from 'quill-delta'
import * as DeltaSlice from '../../../util/DeltaSlice'

describe('DeltaSlice', () => {
    it('should get slices', () => {
        const delta = new Delta()
            .insert('First line\n')
            .insert('Second line\n')
            .insert('Modified third line\n', { added: true })

        const slices = DeltaSlice.getUpdatedSlicesFromContents(delta)

        expect(slices).toEqual([
            {
                lines: [
                    {
                        attributes: {},
                        delta: { ops: [{ insert: 'Second line' }] },
                        isPaneEmbed: false
                    },
                    {
                        attributes: { added: true },
                        delta: {
                            ops: [
                                {
                                    attributes: { added: true },
                                    insert: 'Modified third line'
                                }
                            ]
                        },
                        isPaneEmbed: false
                    }
                ]
            }
        ])
    })

    it('should preserve list formatting', () => {
        const diffDocContents = new Delta({
            ops: [
                {
                    insert: 'Test todo documennt',
                    attributes: {
                        author: 7
                    }
                },
                {
                    insert: '\n\n',
                    attributes: {
                        author: 9
                    }
                },
                {
                    attributes: {
                        author: 9,
                        added: true
                    },
                    insert: 'let test some todo\nfirst todo'
                },
                {
                    attributes: {
                        list: 'unchecked',
                        author: 9,
                        added: true
                    },
                    insert: '\n'
                },
                {
                    attributes: {
                        author: 9,
                        added: true
                    },
                    insert: 'second todo'
                },
                {
                    attributes: {
                        list: 'checked',
                        added: true
                    },
                    insert: '\n'
                },
                {
                    attributes: {
                        author: 9,
                        added: true
                    },
                    insert: '\nand some other list item\nfirst'
                },
                {
                    attributes: {
                        list: 'bullet',
                        author: 9,
                        added: true
                    },
                    insert: '\n'
                },
                {
                    attributes: {
                        author: 9,
                        added: true
                    },
                    insert: 'second'
                },
                {
                    attributes: {
                        list: 'bullet',
                        author: 9,
                        added: true
                    },
                    insert: '\n'
                }
            ]
        })

        const slices = DeltaSlice.getUpdatedSlicesFromContents(diffDocContents)

        expect(DeltaSlice.composeSlices(slices)).toEqual([
            {
                ops: [
                    {
                        attributes: {
                            author: 9
                        },
                        insert: '\n'
                    },
                    {
                        attributes: {
                            author: 9,
                            added: true
                        },
                        insert: 'let test some todo\nfirst todo'
                    },
                    {
                        attributes: {
                            list: 'unchecked',
                            author: 9,
                            added: true
                        },
                        insert: '\n'
                    },
                    {
                        attributes: {
                            author: 9,
                            added: true
                        },
                        insert: 'second todo'
                    },
                    {
                        attributes: {
                            list: 'checked',
                            added: true
                        },
                        insert: '\n'
                    },
                    {
                        attributes: {
                            author: 9,
                            added: true
                        },
                        insert: '\nand some other list item\nfirst'
                    },
                    {
                        attributes: {
                            list: 'bullet',
                            author: 9,
                            added: true
                        },
                        insert: '\n'
                    },
                    {
                        insert: 'second',
                        attributes: {
                            author: 9,
                            added: true
                        }
                    },
                    {
                        insert: '\n',
                        attributes: {
                            list: 'bullet',
                            author: 9,
                            added: true
                        }
                    }
                ]
            }
        ])
    })

    it('getUpdatedSlicesFromContents should ignore empty lines', () => {
        let delta = new Delta()
            .insert('\n')
            .insert('\n\n\n')
            .insert('\n\n', { added: true })
            .insert('\n')

        let slices = DeltaSlice.getUpdatedSlicesFromContents(delta)

        expect(slices).toHaveLength(0)

        delta = new Delta()
            .insert('\n')
            .insert('\n\n\n')
            .insert('Text', { added: true })
            .insert('\n')
            .insert('\n\n\n')
            .insert('\n\n', { added: true })

        slices = DeltaSlice.getUpdatedSlicesFromContents(delta)

        expect(slices).toHaveLength(1)
        expect(slices[0].lines).toHaveLength(3)
    })

    it('should determine if an op is a valid updated op', () => {
        const goodLine = {
            attributes: {
                added: true,
                list: 'bullet'
            },
            insert: '\n'
        }
        expect(DeltaSlice.isUpdatedOp(goodLine)).toBeTruthy()

        const badLine = {
            attributes: {
                added: true,
                author: 1
            },
            insert: '\n'
        }
        expect(DeltaSlice.isUpdatedOp(badLine)).toBeFalsy()

        const goodOp = {
            attributes: {
                added: true
            },
            insert: 'Hello World!'
        }
        expect(DeltaSlice.isUpdatedOp(goodOp)).toBeTruthy()
    })

    it('should get the right number of slices for a changed doc that has one slice', () => {
        const lines = [
            { ops: [{ insert: 'Email Testing', attributes: { author: 1 } }] },
            {
                ops: [{ insert: "Here's something", attributes: { author: 1 } }]
            },
            {
                ops: [
                    {
                        insert: 'A changed line',
                        attributes: { author: 1, added: true }
                    }
                ]
            },
            { ops: [{ insert: 'A last line', attributes: { author: 1 } }] }
        ]
        const test = {
            ops: [],
            eachLine: (callback: any) => {
                lines.forEach((line) => {
                    callback(line)
                })
            }
        }
        const slices = DeltaSlice.getUpdatedSlicesFromContents(test as any)
        expect(slices).toHaveLength(1)
        const firstSlice = slices[0] as DeltaSlice.Slice
        expect(firstSlice.lines).toHaveLength(3)
        expect(firstSlice.lines[0].delta).toEqual(lines[1])
    })

    it('should get the right number of slices for a changed doc that has multiple additions', () => {
        const lines = [
            { ops: [{ insert: 'Email Testing', attributes: { author: 1 } }] },
            {
                ops: [{ insert: "Here's something", attributes: { author: 1 } }]
            },
            {
                ops: [
                    {
                        insert: 'A changed line',
                        attributes: { author: 1, added: true }
                    }
                ]
            },
            {
                ops: [
                    { insert: 'An unchanged line', attributes: { author: 1 } }
                ]
            },
            {
                ops: [
                    {
                        insert: 'A second unchanged line',
                        attributes: { author: 1 }
                    }
                ]
            },
            {
                ops: [
                    {
                        insert: 'A second changed line',
                        attributes: { author: 1, added: true }
                    }
                ]
            }
        ]
        const test = {
            ops: [],
            eachLine: (callback: any) => {
                lines.forEach((line) => {
                    callback(line)
                })
            }
        }
        const slices = DeltaSlice.getUpdatedSlicesFromContents(test as any)
        expect(slices).toHaveLength(1)
        const firstSlice = slices[0] as DeltaSlice.Slice
        expect(firstSlice.lines).toHaveLength(5)
        expect(firstSlice.lines[0].delta).toEqual(lines[1])
        expect(firstSlice.lines[4].delta).toEqual(lines[5])
    })

    it('should get the right number of slices for a changed doc that has two slices', () => {
        const lines = [
            { ops: [{ insert: 'Email Testing', attributes: { author: 1 } }] },
            {
                ops: [{ insert: "Here's something", attributes: { author: 1 } }]
            },
            {
                ops: [
                    {
                        insert: 'A changed line',
                        attributes: { author: 1, added: true }
                    }
                ]
            },
            {
                ops: [
                    { insert: 'An unchanged line', attributes: { author: 1 } }
                ]
            },
            {
                ops: [
                    {
                        insert: 'A changed line that will trigger a new slice',
                        attributes: { author: 1 }
                    }
                ]
            },
            {
                ops: [
                    {
                        insert: 'A second unchanged line',
                        attributes: { author: 1 }
                    }
                ]
            },
            {
                ops: [
                    {
                        insert: 'A second changed line',
                        attributes: { author: 1, added: true }
                    }
                ]
            },
            {
                ops: [
                    {
                        insert: 'A final unchanged line',
                        attributes: { author: 1 }
                    }
                ]
            }
        ]
        const test = {
            ops: [],
            eachLine: (callback: any) => {
                lines.forEach((line, index) => {
                    callback(new Delta(line), {}, index)
                })
            }
        }
        const slices = DeltaSlice.getUpdatedSlicesFromContents(test as any)

        expect(slices).toHaveLength(2)
        const secondSlice = slices[1] as DeltaSlice.Slice
        expect(secondSlice.lines).toHaveLength(3)
        expect(secondSlice.lines[0].delta).toEqual(new Delta(lines[5]))
        expect(secondSlice.lines[1].delta).toEqual(new Delta(lines[6]))
        expect(secondSlice.lines[2].delta).toEqual(new Delta(lines[7]))
    })

    it('should compose slices', () => {
        const slices = [
            {
                lines: [
                    {
                        delta: new Delta({
                            ops: [
                                {
                                    insert: "Here's something",
                                    attributes: {
                                        author: 1
                                    }
                                }
                            ]
                        }),
                        attributes: {},
                        isPaneEmbed: false
                    },
                    {
                        delta: new Delta({
                            ops: [
                                {
                                    insert: 'A changed line',
                                    attributes: {
                                        author: 1,
                                        added: true
                                    }
                                }
                            ]
                        }),
                        attributes: {},
                        isPaneEmbed: false
                    },
                    {
                        delta: new Delta({
                            ops: [
                                {
                                    insert: 'An unchanged line',
                                    attributes: {
                                        author: 1
                                    }
                                }
                            ]
                        }),
                        attributes: {},
                        isPaneEmbed: false
                    }
                ]
            },
            {
                lines: [
                    {
                        delta: new Delta({
                            ops: [
                                {
                                    insert: 'A second unchanged line',
                                    attributes: {
                                        author: 1
                                    }
                                }
                            ]
                        }),
                        attributes: {},
                        isPaneEmbed: false
                    },
                    {
                        delta: new Delta({
                            ops: [
                                {
                                    insert: 'A second changed line',
                                    attributes: {
                                        author: 1,
                                        added: true
                                    }
                                }
                            ]
                        }),
                        attributes: {},
                        isPaneEmbed: false
                    },
                    {
                        delta: new Delta({
                            ops: [
                                {
                                    insert: 'A final unchanged line',
                                    attributes: {
                                        author: 1
                                    }
                                }
                            ]
                        }),
                        attributes: {},
                        isPaneEmbed: false
                    }
                ]
            }
        ]

        const composedSlices = DeltaSlice.composeSlices(slices)

        expect(composedSlices).toEqual([
            {
                ops: [
                    {
                        attributes: {
                            author: 1
                        },
                        insert: "Here's something"
                    },
                    {
                        insert: '\n'
                    },
                    {
                        attributes: {
                            author: 1,
                            added: true
                        },
                        insert: 'A changed line'
                    },
                    {
                        insert: '\n'
                    },
                    {
                        insert: 'An unchanged line',
                        attributes: {
                            author: 1
                        }
                    },
                    {
                        insert: '\n'
                    }
                ]
            },
            {
                ops: [
                    {
                        attributes: {
                            author: 1
                        },
                        insert: 'A second unchanged line'
                    },
                    {
                        insert: '\n'
                    },
                    {
                        attributes: {
                            author: 1,
                            added: true
                        },
                        insert: 'A second changed line'
                    },
                    {
                        insert: '\n'
                    },
                    {
                        insert: 'A final unchanged line',
                        attributes: {
                            author: 1
                        }
                    },
                    {
                        insert: '\n'
                    }
                ]
            }
        ])
    })

    it('should only make one slice when additions are together', async () => {
        const lines = [
            { ops: [{ insert: 'Email Testing', attributes: { author: 1 } }] },
            {
                ops: [{ insert: "Here's something", attributes: { author: 1 } }]
            },
            {
                ops: [
                    {
                        insert: 'A changed line',
                        attributes: { author: 1, added: true }
                    }
                ]
            },
            {
                ops: [
                    { insert: 'An unchanged line', attributes: { author: 1 } }
                ]
            },
            {
                ops: [
                    {
                        insert: 'A second unchanged line',
                        attributes: { author: 1 }
                    }
                ]
            },
            {
                ops: [
                    {
                        insert: 'A second changed line',
                        attributes: { author: 1, added: true }
                    }
                ]
            },
            {
                ops: [
                    {
                        insert: 'A third changed line',
                        attributes: { author: 1, added: true }
                    }
                ]
            }
        ]
        const test = {
            ops: [],
            eachLine: (callback: any) => {
                lines.forEach((line, index) => {
                    callback(line, {}, index)
                })
            }
        }
        const slices = DeltaSlice.getUpdatedSlicesFromContents(test as any)
        expect(slices).toHaveLength(1)
        const firstSlice = slices[0] as DeltaSlice.Slice
        expect(firstSlice.lines[0].delta).toEqual(lines[1])
        expect(firstSlice.lines[1].delta).toEqual(lines[2])
        expect(firstSlice.lines[2].delta).toEqual(lines[3])
        expect(firstSlice.lines[3].delta).toEqual(lines[4])
        expect(firstSlice.lines[4].delta).toEqual(lines[5])
        expect(firstSlice.lines[5].delta).toEqual(lines[6])
    })

    it('should slice a first line addition correctly', async () => {
        const lines = [
            { ops: [{ insert: 'Email Testing', attributes: { author: 1 } }] },
            {
                ops: [
                    {
                        insert: 'A changed line',
                        attributes: { author: 1, added: true }
                    }
                ]
            }
        ]
        const test = {
            ops: [],
            eachLine: (callback: any) => {
                lines.forEach((line, index) => {
                    callback(line, {}, index)
                })
            }
        }
        const slices = DeltaSlice.getUpdatedSlicesFromContents(test as any)
        expect(slices).toHaveLength(1)
        const firstSlice = slices[0] as DeltaSlice.Slice
        expect(firstSlice.lines[0].delta).toEqual(lines[1])
    })

    it('should get slices authors', () => {
        let diff = new Delta({
            ops: [
                {
                    insert: 'Untitled'
                },
                {
                    insert: '\n',
                    attributes: {
                        header: 1
                    }
                },
                {
                    insert: 'This is a document ',
                    attributes: {
                        author: '9'
                    }
                },
                {
                    insert: 'whose',
                    attributes: {
                        mark: ['cjhulvfr600003i5pkk7tihnl'],
                        author: '9'
                    }
                },
                {
                    insert: ' text is synced',
                    attributes: {
                        author: '9',
                        added: true
                    }
                },
                {
                    insert: ' in real time\n',
                    attributes: {
                        author: '9',
                        added: true
                    }
                },
                {
                    attributes: {
                        author: '9'
                    },
                    insert: '\n'
                }
            ]
        })

        let slices = DeltaSlice.getUpdatedSlicesFromContents(diff)
        let composedSlices = DeltaSlice.composeSlices(slices)

        expect(DeltaSlice.getSlicesAuthorIds(composedSlices)).toEqual([[9]])

        diff = new Delta({
            ops: [
                {
                    insert: 'Untitled'
                },
                {
                    insert: '\n',
                    attributes: {
                        header: 1
                    }
                },
                {
                    insert: 'This is a document ',
                    attributes: {
                        author: '9'
                    }
                },
                {
                    insert: 'whose',
                    attributes: {
                        mark: ['cjhulvfr600003i5pkk7tihnl'],
                        author: '9'
                    }
                },
                {
                    insert: ' text is synced',
                    attributes: {
                        author: '9',
                        added: true
                    }
                },
                {
                    insert: ' in real time\n',
                    attributes: {
                        author: '8',
                        added: true
                    }
                },
                {
                    attributes: {
                        author: '9'
                    },
                    insert: '\n'
                },
                {
                    insert: ' as opposed\n',
                    attributes: {
                        author: '8'
                    }
                },
                {
                    insert: ' to imaginary\n',
                    attributes: {
                        author: '9'
                    }
                },
                {
                    insert: ' time\n',
                    attributes: {
                        author: '2',
                        added: true
                    }
                }
            ]
        })

        slices = DeltaSlice.getUpdatedSlicesFromContents(diff)
        composedSlices = DeltaSlice.composeSlices(slices)

        expect(DeltaSlice.getSlicesAuthorIds(composedSlices)).toEqual([
            [9, 8],
            [2]
        ])
    })

    it('should slice panes correctly', () => {
        const contents = new Delta()
            .insert('Email Test \n', { author: 1 })
            .insert('Heres something\n', { author: 1 })
            .insert({ 'pane-embed': {} }, { author: 1, added: true })
            .insert('\nAn unchanged line\n', { author: 1 })

        const composedSlices = DeltaSlice.getUpdatedSlicesFromContents(contents)

        expect(composedSlices).toEqual([
            {
                lines: [
                    {
                        attributes: {
                            author: 1
                        },
                        delta: {
                            ops: [
                                {
                                    attributes: {
                                        added: true,
                                        author: 1
                                    },
                                    insert: {
                                        'pane-embed': {}
                                    }
                                }
                            ]
                        },
                        isPaneEmbed: true
                    }
                ]
            }
        ])
    })
})
