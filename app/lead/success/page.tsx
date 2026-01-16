import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SuccessPage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-950 flex items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle className='text-2xl text-center text-green-800 dark:text-green-200'>
            Thank You!
          </CardTitle>
        </CardHeader>
        <CardContent className='text-center space-y-4'>
          <p className='text-gray-700 dark:text-gray-300'>
            Mike will be in touch within 15 minutes with your home valuation.
          </p>
          <div className='p-4 bg-gray-100 dark:bg-gray-800 rounded'>
            <p className='text-sm text-gray-600 dark:text-gray-400'>
              &ldquo;Mike called me in 8 minutes!&rdquo; - Sarah T.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
