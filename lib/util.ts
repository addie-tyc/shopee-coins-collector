
export async function wait (durationMs:number = 0): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, durationMs)
  })
}
