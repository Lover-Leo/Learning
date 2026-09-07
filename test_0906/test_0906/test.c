#define _CRT_SECURE_NO_WARNINGS
//#include<stdio.h>
//int main()
//{
//    int a = 0;
//    scanf("%d", &a);
//    if (a % 2 == 1)
//        printf("%d为奇数\n", a);
//    else
//        printf("%d为偶数\n", a);
//    return 0;
//}


#include<stdio.h>
int main()
{
	int a = 1;
	while (a < 101)
	{
		if (a % 2 == 1)
		{
			printf("%d	", a);	
        	}
		a++;
	}
	return 0;
}